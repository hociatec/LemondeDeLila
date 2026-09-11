/** Wall-clock milliseconds for application decisions, never elapsed-time metrics. */
export const BUSINESS_CLOCK = Symbol('BUSINESS_CLOCK');
export interface BusinessClock {
  now(): number;
}
