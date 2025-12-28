import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import {
  PhaseDefinition,
  PhaseEngineService,
} from '../../../../modules/state/services/phase-engine.service';
import { PlayerStateService } from '../../../../modules/player/services/player-state.service';
import { VoteService } from '../../../../modules/vote/services/vote.service';
import { ActionLogService } from '../../../../modules/actionlog/services/action-log.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import type {
  GarouMetadata,
  GarouStep,
  GarouWinner,
} from '../model/loup-garou.types';
import { LoupGarouSetupService } from '../setup/loup-garou-setup.service';
import { LOUP_GAROU_GAME } from '../definitions/game.definition';
import { LOUP_GAROU_RULEBOOK } from '../rulebook/rulebook';

@Injectable()
export class LoupGarouPhaseService {
  constructor(
    private readonly core: GameCoreService,
    private readonly phases: PhaseEngineService<GarouMetadata>,
    private readonly players: PlayerStateService,
    private readonly voteService: VoteService,
    private readonly actionLog: ActionLogService,
    private readonly victory: VictoryService,
    private readonly setup: LoupGarouSetupService,
  ) {}

  advanceState(state: GameStateEntity): GameStateEntity {
    let current = this.setup.ensureMetadata(state);
    let phaseId = this.setup.metadataOf(current).step;
    const phases = this.buildPhases();
    const order = LOUP_GAROU_GAME.phaseOrder.map((p) => p.id) as GarouStep[];
    const nextPhaseId = (id: GarouStep): GarouStep => {
      const idx = order.indexOf(id);
      if (idx < 0) return order[0] ?? id;
      return order[(idx + 1) % order.length] ?? order[0] ?? id;
    };
    let safety = 0;
    while (safety++ < 20) {
      const meta = this.setup.metadataOf(current);
      if (meta.winner) return { ...current, status: 'finished' };
      const advanced = this.phases.advance(current, meta, phases, phaseId);
      current = advanced.state;
      const newMeta = this.setup.metadataOf(current);
      const entered = advanced.phaseId as GarouStep;
      phaseId = entered;
      if (newMeta.step !== entered) {
        current = this.setup.withStep(current, entered);
      }
      if (['seer', 'cupid', 'wolves', 'witch', 'day-vote'].includes(phaseId)) {
        return current;
      }
      // Phases système : avancer explicitement dans l'ordre pour éviter de ré-exécuter
      // la même phase en boucle (PhaseEngine retourne toujours la phase courante si canEnter=true).
      phaseId = nextPhaseId(entered);
    }
    this.core.appendLog?.(
      current,
      '[LoupGarou] Avertissement: boucle de progression interrompue.',
    );
    return current;
  }

  resolveDay(state: GameStateEntity): GameStateEntity {
    const meta = this.setup.metadataOf(state);
    const votes = meta.votes ?? {};
    const result = this.voteService.resolveVotes(votes, meta.tiePolicy);
    const executed = result.winnerId;
    let next = state;
    if (executed != null) {
      next = this.players.kill(next, executed);
      const lovers = meta.lovers;
      if (lovers && lovers.includes(executed)) {
        const partner = lovers[0] === executed ? lovers[1] : lovers[0];
        if (this.players.isAlive(next, partner)) {
          next = this.players.kill(next, partner);
        }
      }
    }
    const updatedMeta: GarouMetadata = {
      ...this.setup.metadataOf(next),
      voteQueue: [],
      votes: {},
      lastAnnouncement: executed != null ? [executed] : [],
      actionLog: this.actionLog.append(this.setup.metadataOf(next).actionLog, {
        step: 'day-vote',
        actorId: null,
        type: 'resolve_day',
        payload: { executed, votes, tally: result.tally, tie: result.tie },
      }),
    };
    return {
      ...next,
      metadata: updatedMeta,
      turn: { currentPlayerId: null, direction: 1 },
    };
  }

  resolveNight(state: GameStateEntity): GameStateEntity {
    const meta = this.setup.metadataOf(state);
    const deaths: number[] = [];
    if (meta.pending.wolvesTarget != null) {
      deaths.push(meta.pending.wolvesTarget);
    }
    if (meta.pending.poisonTarget != null) {
      deaths.push(meta.pending.poisonTarget);
    }
    const unique = [...new Set(deaths)].filter((id) =>
      this.players.isAlive(state, id),
    );
    let next = state;
    unique.forEach((id) => {
      next = this.players.kill(next, id);
    });
    const lovers = meta.lovers;
    if (lovers) {
      const [a, b] = lovers;
      if (!this.players.isAlive(next, a) && this.players.isAlive(next, b)) {
        next = this.players.kill(next, b);
      }
      if (!this.players.isAlive(next, b) && this.players.isAlive(next, a)) {
        next = this.players.kill(next, a);
      }
    }
    const updatedMeta: GarouMetadata = {
      ...this.setup.metadataOf(next),
      nightDeaths: unique,
      lastAnnouncement: unique,
      pending: {
        wolvesChoices: {},
        wolvesTarget: null,
        poisonTarget: null,
        seerUsed: false,
        witchUsed: false,
      },
      actionLog: this.actionLog.append(this.setup.metadataOf(next).actionLog, {
        step: 'resolve-night',
        actorId: null,
        type: 'resolve_night',
        payload: {
          wolvesTarget: meta.pending.wolvesTarget,
          poisonTarget: meta.pending.poisonTarget,
          deaths: unique,
        },
      }),
    };
    return {
      ...next,
      metadata: updatedMeta,
      turn: { currentPlayerId: null, direction: 1 },
    };
  }

  startNextNight(state: GameStateEntity): GameStateEntity {
    const meta = this.setup.metadataOf(state);
    const nextMeta: GarouMetadata = {
      ...meta,
      day: meta.day + 1,
      firstNight: false,
      step: 'seer',
      pending: {
        wolvesChoices: {},
        wolvesTarget: null,
        poisonTarget: null,
        seerUsed: false,
        witchUsed: false,
      },
      nightDeaths: [],
      lastAnnouncement: [],
    };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      turn: {
        currentPlayerId: LOUP_GAROU_RULEBOOK.phaseTurnOwner(
          state,
          nextMeta,
          'seer',
        ),
        direction: 1,
      },
    };
    return this.advanceState(nextState);
  }

  private buildPhases(): PhaseDefinition<GarouMetadata>[] {
    const byId: Record<string, PhaseDefinition<GarouMetadata>> = {
      seer: {
        id: 'seer',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'seer'),
        onEnter: (s, m) =>
          this.setup.withTurn(
            s,
            LOUP_GAROU_RULEBOOK.phaseTurnOwner(s, m, 'seer'),
          ),
      },
      cupid: {
        id: 'cupid',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'cupid'),
        onEnter: (s, m) =>
          this.setup.withTurn(
            s,
            LOUP_GAROU_RULEBOOK.phaseTurnOwner(s, m, 'cupid'),
          ),
      },
      wolves: {
        id: 'wolves',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'wolves'),
        onEnter: (s, m) =>
          this.setup.withTurn(
            s,
            LOUP_GAROU_RULEBOOK.phaseTurnOwner(s, m, 'wolves'),
          ),
      },
      witch: {
        id: 'witch',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'witch'),
        onEnter: (s, m) =>
          this.setup.withTurn(
            s,
            LOUP_GAROU_RULEBOOK.phaseTurnOwner(s, m, 'witch'),
          ),
      },
      'resolve-night': {
        id: 'resolve-night',
        onEnter: (s) => this.resolveNight(s),
      },
      announce: {
        id: 'announce',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'announce'),
        onEnter: (s) => s,
      },
      'day-vote': {
        id: 'day-vote',
        canEnter: (s, m) => LOUP_GAROU_RULEBOOK.canEnterPhase(s, m, 'day-vote'),
        onEnter: (s, m) => {
          return this.setup.withTurn(
            s,
            LOUP_GAROU_RULEBOOK.phaseTurnOwner(s, m, 'day-vote'),
          );
        },
      },
      'resolve-day': {
        id: 'resolve-day',
        onEnter: (s) => this.resolveDay(s),
      },
      'check-victory': {
        id: 'check-victory',
        onEnter: (s) => {
          const result = this.victory.evaluate(s, LOUP_GAROU_GAME.victory);
          if (result?.finished) {
            const winner = (result.winnerId as GarouWinner | null) ?? null;
            const metaWithWinner: GarouMetadata = {
              ...this.setup.metadataOf(s),
              winner,
              victoryId: result.conditionId,
            };
            const finished = {
              ...s,
              metadata: metaWithWinner,
              status: 'finished',
              turn: { currentPlayerId: null, direction: 1 as const },
            };
            const message =
              winner === 'wolves'
                ? 'Victoire des Loups.'
                : winner === 'lovers'
                  ? 'Victoire des Amoureux.'
                  : 'Victoire du Village.';
            return this.core.appendLog(finished, `[LoupGarou] ${message}`);
          }
          return this.startNextNight(s);
        },
      },
    };

    return LOUP_GAROU_GAME.phaseOrder.map((p) => byId[p.id]);
  }
}
