import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';

export type VictoryCheckResult = {
  finished: boolean;
  winnerId?: number | string | null;
  details?: Record<string, unknown>;
};

export type VictoryCondition = {
  id: string;
  description?: string;
  check: (state: GameStateEntity) => VictoryCheckResult | boolean;
};

@Injectable()
export class VictoryService {
  checkCriteria(state: GameStateEntity, checks: Array<(s: GameStateEntity) => boolean>): boolean {
    return checks.some((fn) => fn(state));
  }

  evaluate(state: GameStateEntity, conditions: VictoryCondition[]): (VictoryCheckResult & { conditionId: string }) | null {
    for (const condition of conditions ?? []) {
      if (!condition?.check) continue;
      const raw = condition.check(state);
      const normalized: VictoryCheckResult =
        typeof raw === 'boolean' ? { finished: raw, winnerId: null } : { winnerId: null, ...raw };
      if (normalized.finished) {
        return { ...normalized, conditionId: condition.id };
      }
    }
    return null;
  }

  getOverview(): ModuleOverviewDto {
    return {
      id: 'victory',
      label: 'Conditions de victoire',
      description: 'Cadre pour définir et vérifier les conditions gagnantes ou de fin de partie.',
      capabilities: [
        { id: 'criteria', description: 'Définition de critères (objectifs, score, positions).' },
        { id: 'checks', description: 'Évaluation des critères à chaque tour ou événement.' },
        { id: 'resolution', description: 'Annonce du vainqueur et fin de partie.' },
      ],
    };
  }
}
