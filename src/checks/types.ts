import type { Page } from 'puppeteer-core'
import type { CheckName, ObservationDraft, ResolvedTarget } from '../types.js'

export interface CheckContext {
  page: Page
  target: ResolvedTarget
  repeat: number
  warm: boolean
  detailRows: number
}

export interface Check {
  name: CheckName
  run(ctx: CheckContext): Promise<ObservationDraft[]>
}
