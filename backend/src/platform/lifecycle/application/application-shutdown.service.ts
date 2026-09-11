import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/** One instance per application. Resources stay open until accepted work settles. */
@Injectable()
export class ApplicationShutdownService {
  private stopping = false;
  private readonly pending = new Set<Promise<unknown>>();
  private readonly sources = new Map<string, () => void | Promise<void>>();
  private stoppedSources: Promise<void> | undefined;

  get isDraining(): boolean {
    return this.stopping;
  }

  registerSource(name: string, stop: () => void | Promise<void>): void {
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (
      !normalizedName ||
      normalizedName.length > 128 ||
      typeof stop !== 'function' ||
      this.stopping ||
      this.sources.has(name)
    ) {
      throw new Error(`Shutdown source cannot be registered: ${normalizedName}`);
    }
    this.sources.set(normalizedName, stop);
  }

  stopAccepting(): void {
    this.stopping = true;
  }

  stopSources(): Promise<void> {
    this.stopAccepting();
    return (this.stoppedSources ??= Promise.all(
      [...this.sources.values()].map((stop) => Promise.resolve().then(stop)),
    ).then(() => undefined));
  }

  run<T>(operation: () => T | Promise<T>, cleanup = false): Promise<T> {
    if (this.stopping && !cleanup) {
      return Promise.reject(
        new ServiceUnavailableException('Server is shutting down'),
      );
    }
    // Invoke synchronously, preserving boundary ordering; also catch sync errors.
    let result: Promise<T>;
    try {
      result = Promise.resolve(operation());
    } catch (error) {
      result = Promise.reject(
        error instanceof Error
          ? error
          : new Error('Operation failed', { cause: error }),
      );
    }
    const tracked = result.finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
    return tracked;
  }

  async drain(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }
  }
}
