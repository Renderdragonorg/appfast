import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppFastError } from '../../errors.js'
import type { Reasoner, ReasonRequest } from '../types.js'

export interface OpenCodeReasonerOptions {
  /** Any model your OpenCode install can run, in `provider/model` form. */
  model?: string
  /** The OpenCode binary. Defaults to `opencode2`. */
  command?: string
  /** How long one model call may take. Defaults to 180000 ms. */
  timeoutMs?: number
  /** Environment for the child process. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv
  /** Injectable for tests. Defaults to spawning the OpenCode binary. */
  exec?: OpenCodeExec
}

export interface OpenCodeExecInput {
  command: string
  args: string[]
  input: string
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs: number
}

export interface OpenCodeExecResult {
  code: number | null
  stdout: string
  stderr: string
}

export type OpenCodeExec = (input: OpenCodeExecInput) => Promise<OpenCodeExecResult>

const DEFAULT_MODEL = 'opencode-go/glm-5.3-flash'
const DEFAULT_COMMAND = 'opencode2'
const DEFAULT_TIMEOUT_MS = 180_000
const MAX_OUTPUT_CHARS = 4 * 1024 * 1024

/**
 * A reasoner backed by OpenCode V2 (`opencode run`) and one of its models.
 * It reuses the caller's OpenCode login, so no provider API key is needed.
 *
 * Each call runs in a throwaway config directory with an agent that denies
 * every permission. The bundle digest is untrusted text, and this keeps it
 * from driving shell or file tools in the caller's project.
 */
export function createOpenCodeReasoner(options: OpenCodeReasonerOptions = {}): Reasoner {
  const model = options.model ?? DEFAULT_MODEL
  const command = options.command ?? DEFAULT_COMMAND
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const exec = options.exec ?? execOpenCode

  return {
    label: `opencode:${model}`,
    async complete({ system, user }: ReasonRequest): Promise<string> {
      const cwd = await mkdtemp(join(tmpdir(), 'appfast-opencode-'))
      try {
        await writeFile(join(cwd, 'opencode.json'), agentConfig(system), 'utf8')

        let result: OpenCodeExecResult
        try {
          result = await exec({
            command,
            args: ['run', '--agent', 'appfast-analyzer', '--model', model, '--format', 'json'],
            input: user,
            cwd,
            env: options.env ?? process.env,
            timeoutMs,
          })
        } catch (error) {
          throw new AppFastError(
            'ANALYSIS',
            `Could not run ${command}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }

        if (result.code !== 0) {
          throw new AppFastError(
            'ANALYSIS',
            `opencode run failed (exit ${result.code ?? 'signal'}): ${tail(result.stderr || result.stdout)}`,
          )
        }

        const text = stripLeadingReasoning(readTextEvents(result.stdout))
        if (text.length === 0) throw new AppFastError('ANALYSIS', 'opencode returned no text')
        return text
      } finally {
        await rm(cwd, { recursive: true, force: true })
      }
    },
  }
}

function agentConfig(system: string): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      agents: {
        'appfast-analyzer': {
          description: 'Judges an AppFast evidence bundle',
          mode: 'primary',
          system,
          permissions: [{ action: '*', resource: '*', effect: 'deny' }],
        },
      },
    },
    null,
    2,
  )
}

/** Pulls assistant text out of `opencode run --format json` event lines. */
function readTextEvents(stdout: string): string {
  const parts: string[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const event = JSON.parse(trimmed) as { type?: unknown; part?: { text?: unknown } }
      if (event.type === 'text' && typeof event.part?.text === 'string') parts.push(event.part.text)
    } catch {
      // Not every line is an event. Banners and partial writes are ignored.
    }
  }
  return parts.join('\n').trim()
}

/** Some models leak a reasoning close tag into the visible text. Trim it. */
function stripLeadingReasoning(text: string): string {
  return text.replace(/^\s*(?:<\/think>|<think>[\s\S]*?<\/think>)\s*/i, '').trim()
}

function tail(text: string, limit = 400): string {
  const trimmed = text.trim()
  return trimmed.length > limit ? `...${trimmed.slice(-limit)}` : trimmed
}

function execOpenCode({ command, args, input, cwd, env, timeoutMs }: OpenCodeExecInput): Promise<OpenCodeExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer: NodeJS.Timeout | undefined

    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      finish()
    }

    timer = setTimeout(() => {
      child.kill('SIGKILL')
      settle(() => reject(new Error(`timed out after ${timeoutMs}ms`)))
    }, timeoutMs)

    child.on('error', (error) => settle(() => reject(error)))
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
      if (stdout.length > MAX_OUTPUT_CHARS) {
        child.kill('SIGKILL')
        settle(() => reject(new Error('output exceeded 4 MiB')))
      }
    })

    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
      if (stderr.length > MAX_OUTPUT_CHARS) stderr = stderr.slice(-MAX_OUTPUT_CHARS)
    })

    child.on('close', (code) => settle(() => resolve({ code, stdout, stderr })))
    // The child can exit before reading stdin. That is not an error we need.
    child.stdin?.on('error', () => {})
    child.stdin?.end(input)
  })
}
