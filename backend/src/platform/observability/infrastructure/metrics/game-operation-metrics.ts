import { Counter, type Registry } from '@prometheus-io/client';
import { BoundedMetricLabel } from './bounded-metric-label';

/** Limits apply across the lifetime of the registry, not independently per request. */
export class GameOperationMetrics {
  private readonly games = new BoundedMetricLabel(
    128,
    /^[a-z][a-z0-9-]{0,95}$/,
  );
  private readonly codes = new BoundedMetricLabel(
    64,
    /^[A-Z][A-Z0-9_]{0,63}$/,
    'OTHER_ERROR',
  );
  private readonly errors: Counter<'game' | 'code' | 'operation'>;

  constructor(registry: Registry) {
    this.errors = new Counter({
      name: 'lila_game_errors_total',
      help: 'Erreurs du moteur par jeu, code stable et opération. Labels bornés.',
      labelNames: ['game', 'code', 'operation'] as const,
      registers: [registry],
    });
  }

  recordFailure(
    game: string,
    code: string,
    operation: 'command' | 'restore' | 'snapshot' | 'replay' | 'commit',
  ): void {
    this.errors.inc({
      game: this.games.resolve(game),
      code: this.codes.resolve(code),
      operation,
    });
  }
}
