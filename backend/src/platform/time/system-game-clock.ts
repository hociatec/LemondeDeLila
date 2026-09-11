import { businessMsToIso } from '../../shared/utils/public-api';

/** System-time adapter. Replay callers supply a fixed clock instead. */
export class SystemGameClock {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return businessMsToIso(this.nowMs());
  }
}
