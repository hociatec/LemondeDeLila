/** Bound retained label values for the entire lifetime of a metrics registry. */
export class BoundedMetricLabel {
  private readonly values = new Set<string>();

  constructor(
    private readonly limit: number,
    private readonly pattern: RegExp,
    private readonly fallback = 'unknown',
  ) {}

  resolve(value: string): string {
    if (
      !this.pattern.test(value) ||
      (!this.values.has(value) && this.values.size >= this.limit)
    )
      return this.fallback;
    this.values.add(value);
    return value;
  }
}
