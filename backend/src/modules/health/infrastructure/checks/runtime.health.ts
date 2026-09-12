import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { promises as fs } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import path from 'node:path';

@Injectable()
export class RuntimeHealthIndicator
  extends HealthIndicator
  implements OnModuleDestroy
{
  private readonly logger = new Logger(RuntimeHealthIndicator.name);
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 });

  constructor(private readonly config: ConfigService) {
    super();
    this.eventLoop.enable();
  }

  checkEventLoop(key: string): HealthIndicatorResult {
    const safeKey =
      typeof key === 'string' && key.length <= 128 ? key : 'runtime';
    const lagMs = Number.isFinite(this.eventLoop.max)
      ? this.eventLoop.max / 1_000_000
      : 0;
    this.eventLoop.reset();
    const configuredMaximum = this.config.get<number>(
      'HEALTH_MAX_EVENT_LOOP_LAG_MS',
      250,
    );
    const maximum =
      Number.isSafeInteger(configuredMaximum) && configuredMaximum >= 0
        ? configuredMaximum
        : 250;
    const status = this.getStatus(safeKey, lagMs <= maximum, {
      lagMs: Math.round(lagMs * 100) / 100,
      maximumLagMs: maximum,
    });
    if (lagMs > maximum) {
      throw new HealthCheckError('Event loop lag too high', status);
    }
    return status;
  }

  async checkStorage(key: string): Promise<HealthIndicatorResult> {
    const safeKey =
      typeof key === 'string' && key.length <= 128 ? key : 'storage';
    const root = path.resolve(
      this.config.get<string>('HEALTH_CHECK_PATH') ??
        this.config.get<string>('LOG_DIR', 'logs'),
    );
    const configuredMinimum = this.config.get<number>(
      'HEALTH_MIN_FREE_BYTES',
      this.config.get<number>('STORAGE_MIN_FREE_BYTES', 104_857_600),
    );
    if (root.length > 4096) {
      throw new HealthCheckError(
        'Invalid storage health path',
        this.getStatus(safeKey, false),
      );
    }
    const minimumFreeBytes =
      Number.isSafeInteger(configuredMinimum) && configuredMinimum >= 0
        ? configuredMinimum
        : 104_857_600;
    const probe = path.join(root, `.health-write-${process.pid}`);
    try {
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(probe, 'ok', { flag: 'wx' });
      await fs.unlink(probe);
      const stats = await fs.statfs(root);
      const freeBytes =
        Number.isSafeInteger(stats.bavail) && Number.isSafeInteger(stats.bsize)
          ? Math.min(Number.MAX_SAFE_INTEGER, stats.bavail * stats.bsize)
          : 0;
      const status = this.getStatus(safeKey, freeBytes >= minimumFreeBytes, {
        path: root,
        freeBytes,
        minimumFreeBytes,
      });
      if (freeBytes < minimumFreeBytes) {
        throw new HealthCheckError('Storage free space too low', status);
      }
      return status;
    } catch (error) {
      try {
        await fs.rm(probe, { force: true });
      } catch (cleanupError) {
        this.logger.warn(
          `storage_probe_cleanup_failed path=${probe} error=${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
      if (error instanceof HealthCheckError) throw error;
      throw new HealthCheckError(
        'Storage check failed',
        this.getStatus(safeKey, false, {
          path: root,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  onModuleDestroy(): void {
    this.eventLoop.disable();
  }
}
