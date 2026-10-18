#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { analyze as analyzeBundle } from './analyze/analyze.js'
import { createAnthropicReasoner } from './analyze/reasoners/anthropic.js'
import { createOpenAiReasoner } from './analyze/reasoners/openai.js'
import { createOpenCodeReasoner } from './analyze/reasoners/opencode.js'
import type { Analysis, Reasoner } from './analyze/types.js'
import { audit } from './audit.js'
import { RenderDragonError } from './errors.js'
import type { Bundle, CheckName, Target } from './types.js'

const USAGE = `renderdragon <command>

Commands:
  audit <url> [options]        run a lab audit and write a bundle
    --out <dir>                output directory (default ./renderdragon-out)
    --runs <n>                 repeats (default 1)
    --throttle mobile|desktop  default mobile
    --checks a,b,c             default scrollJank,heavyPayload,interactionStorm
    --json                     print the bundle as JSON

  analyze <bundle.json> [options]   judge a bundle with a model
    --provider anthropic|openai|opencode   default: inferred from env keys
    --model <name>                  default: the adapter's default
    --json                          print the analysis as JSON

  help`

export interface AuditCommand {
  command: 'audit'
  url: string
  out?: string
  runs?: number
  throttle?: 'mobile' | 'desktop'
  checks?: CheckName[]
  json: boolean
}

export interface AnalyzeCommand {
  command: 'analyze'
  file: string
  provider?: string
  model?: string
  json: boolean
}

export interface HelpCommand {
  command: 'help'
}

export type ParsedCommand = AuditCommand | AnalyzeCommand | HelpCommand

function parseFlags(args: string[]): { positionals: string[]; flags: Map<string, string | boolean> } {
  const positionals: string[] = []
  const flags = new Map<string, string | boolean>()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    if (eq !== -1) {
      flags.set(arg.slice(2, eq), arg.slice(eq + 1))
      continue
    }
    const key = arg.slice(2)
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(key, next)
      i++
    } else {
      flags.set(key, true)
    }
  }
  return { positionals, flags }
}

/** Parses argv (without the node/script prefix) into a command. Pure. */
export function parseArgs(argv: string[]): ParsedCommand {
  const [first, ...rest] = argv
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') return { command: 'help' }
  if (first === 'audit') return parseAudit(rest)
  if (first === 'analyze') return parseAnalyze(rest)
  throw new Error(`Unknown command: ${first}`)
}

function parseAudit(args: string[]): AuditCommand {
  const { positionals, flags } = parseFlags(args)
  const url = positionals[0]
  if (!url) throw new Error('audit requires a <url>')
  const command: AuditCommand = { command: 'audit', url, json: flags.get('json') === true }

  const out = flags.get('out')
  if (typeof out === 'string') command.out = out

  const runs = flags.get('runs')
  if (typeof runs === 'string') {
    const parsed = Number(runs)
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error('--runs must be a positive integer')
    command.runs = parsed
  }

  const throttle = flags.get('throttle')
  if (typeof throttle === 'string') {
    if (throttle !== 'mobile' && throttle !== 'desktop') throw new Error('--throttle must be mobile or desktop')
    command.throttle = throttle
  }

  const checks = flags.get('checks')
  if (typeof checks === 'string') {
    command.checks = checks
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean) as CheckName[]
  }

  return command
}

function parseAnalyze(args: string[]): AnalyzeCommand {
  const { positionals, flags } = parseFlags(args)
  const file = positionals[0]
  if (!file) throw new Error('analyze requires a <bundle.json>')
  const command: AnalyzeCommand = { command: 'analyze', file, json: flags.get('json') === true }
  const provider = flags.get('provider')
  if (typeof provider === 'string') command.provider = provider
  const model = flags.get('model')
  if (typeof model === 'string') command.model = model
  return command
}

export interface CliDeps {
  audit(input: Target): Promise<Bundle>
  analyze(bundle: Bundle, reasoner: Reasoner): Promise<Analysis>
  createReasoner(provider: string, model?: string): Reasoner
  readTextFile(path: string): Promise<string>
  io: { out(message: string): void; err(message: string): void }
  env: NodeJS.ProcessEnv
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function inferProvider(env: NodeJS.ProcessEnv): string | undefined {
  if (env.ANTHROPIC_API_KEY) return 'anthropic'
  if (env.OPENAI_API_KEY) return 'openai'
  return undefined
}

function printAudit(bundle: Bundle, outputDir: string, out: (message: string) => void): void {
  out(`Audited ${bundle.target.url}`)
  out('Metrics:')
  if (bundle.metrics.length === 0) out('  (none)')
  for (const metric of bundle.metrics) {
    out(`  ${metric.name}: ${metric.median}${metric.unit === 'ms' ? 'ms' : ''} (min ${metric.min}, max ${metric.max})`)
  }
  out(`Observations: ${bundle.observations.length}`)
  if (bundle.caveats.length > 0) out(`Caveats: ${bundle.caveats.join('; ')}`)
  out(`Bundle and artifacts written to ${outputDir}`)
}

function printAnalysis(analysis: Analysis, out: (message: string) => void): void {
  out(analysis.summary)
  for (const finding of analysis.findings) {
    out('')
    out(`[${finding.severity.toUpperCase()}] ${finding.title}`)
    out(`  ${finding.rationale}`)
    if (finding.evidence.length > 0) {
      out(`  evidence: ${finding.evidence.map((ref) => `${ref.kind}:${ref.ref}`).join(', ')}`)
    }
    if (finding.recommendation) out(`  fix: ${finding.recommendation}`)
  }
}

/** Runs one CLI invocation and returns an exit code. Pure enough to test with fake deps. */
export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  let parsed: ParsedCommand
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    deps.io.err(`error: ${message(error)}`)
    deps.io.err(USAGE)
    return 1
  }

  if (parsed.command === 'help') {
    deps.io.out(USAGE)
    return 0
  }

  try {
    if (parsed.command === 'audit') {
      const target: Target = { url: parsed.url }
      target.outputDir = parsed.out ?? 'renderdragon-out'
      if (parsed.runs !== undefined) target.runs = parsed.runs
      if (parsed.throttle !== undefined) target.throttle = parsed.throttle
      if (parsed.checks !== undefined) target.checks = parsed.checks

      const bundle = await deps.audit(target)
      if (parsed.json) deps.io.out(JSON.stringify(bundle, null, 2))
      else printAudit(bundle, target.outputDir as string, deps.io.out)
      return 0
    }

    const provider = parsed.provider ?? inferProvider(deps.env)
    if (!provider) {
      throw new RenderDragonError(
        'CONFIG',
        'No provider: pass --provider (anthropic, openai, opencode), or set ANTHROPIC_API_KEY or OPENAI_API_KEY',
      )
    }
    const bundle = JSON.parse(await deps.readTextFile(parsed.file)) as Bundle
    const analysis = await deps.analyze(bundle, deps.createReasoner(provider, parsed.model))
    if (parsed.json) deps.io.out(JSON.stringify(analysis, null, 2))
    else printAnalysis(analysis, deps.io.out)
    return 0
  } catch (error) {
    deps.io.err(`error: ${message(error)}`)
    return 1
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const code = await runCli(argv, {
    audit,
    analyze: analyzeBundle,
    createReasoner: (provider, model) => {
      if (provider === 'anthropic') return createAnthropicReasoner(model ? { model } : {})
      if (provider === 'openai') return createOpenAiReasoner(model ? { model } : {})
      if (provider === 'opencode') return createOpenCodeReasoner(model ? { model } : {})
      throw new RenderDragonError('CONFIG', `Unknown provider: ${provider}`)
    },
    readTextFile: (path) => readFile(path, 'utf8'),
    io: { out: (message) => console.log(message), err: (message) => console.error(message) },
    env: process.env,
  })
  process.exitCode = code
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main()
}
