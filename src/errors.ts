export type ErrorCode =
  | 'BROWSER_LAUNCH'
  | 'NAVIGATION'
  | 'LIGHTHOUSE'
  | 'CHECK'
  | 'AUTH_EXPIRED'
  | 'CONFIG'
  | 'ANALYSIS'

export class AppFastError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppFastError'
    this.code = code
  }
}
