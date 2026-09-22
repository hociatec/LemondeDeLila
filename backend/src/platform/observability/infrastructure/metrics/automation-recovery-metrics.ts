import {
  Counter,
  Gauge,
  Histogram,
  type Registry,
} from '@prometheus-io/client';

export class AutomationRecoveryMetrics {
  private readonly sessions: Counter<'outcome'>;
  private readonly duration: Histogram;
  private readonly deferred: Gauge;
  private readonly sweeps: Counter;

  constructor(registry: Registry) {
    this.sessions = new Counter({
      name: 'lila_game_recovery_sessions_total',
      help: 'Sessions examined by recovery, with fixed outcome labels.',
      labelNames: ['outcome'],
      registers: [registry],
    });
    this.duration = new Histogram({
      name: 'lila_game_recovery_pass_seconds',
      help: 'Duration of one bounded recovery pass.',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [registry],
    });
    this.deferred = new Gauge({
      name: 'lila_game_recovery_deferred_sessions',
      help: 'Locally quarantined sessions awaiting retry.',
      registers: [registry],
    });
    this.sweeps = new Counter({
      name: 'lila_game_recovery_sweeps_total',
      help: 'Completed SQL recovery sweeps.',
      registers: [registry],
    });
  }

  session(
    outcome: 'scheduled' | 'obsolete' | 'missing' | 'failed' | 'deferred',
  ): void {
    this.sessions.inc({ outcome });
  }
  pass(seconds: number, deferred: number): void {
    this.duration.observe(Math.max(0, seconds));
    this.deferred.set(deferred);
  }
  sweep(): void {
    this.sweeps.inc();
  }
}
