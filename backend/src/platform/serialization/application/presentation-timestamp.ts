import { businessMsToIso } from '../../../shared/utils/public-api';

/** UTC envelope-generation time. Never use this for expiry or business decisions. */
export function presentationTimestamp(nowMs: () => number = Date.now): string {
  return businessMsToIso(nowMs());
}
