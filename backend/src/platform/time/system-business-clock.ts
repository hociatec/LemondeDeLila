import type { BusinessClock } from '../../shared/interfaces/public-api';

export class SystemBusinessClock implements BusinessClock {
  now(): number {
    return Date.now();
  }
}
