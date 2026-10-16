export type ErrorCode =
  | 'BROWSER_LAUNCH'
  | 'NAVIGATION'
  | 'LIGHTHOUSE'
  | 'CHECK'
  | 'AUTH_EXPIRED'
  | 'CONFIG'

export class RenderDragonError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RenderDragonError'
    this.code = code
  }
}
