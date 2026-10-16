import type { CheckName } from '../types.js'
import type { Check } from './types.js'
import { scrollJank } from './scrollJank.js'
import { heavyPayload } from './heavyPayload.js'
import { interactionStorm } from './interactionStorm.js'
import { longSession } from './longSession.js'

export const CHECKS: Record<CheckName, Check> = {
  scrollJank,
  heavyPayload,
  interactionStorm,
  longSession,
}
