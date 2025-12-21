import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { PlayerStateService } from '../../../../../modules/player/services/player-state.service';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import type { GarouMetadata, GarouRole } from '../model/loup-garou.types';
import { LoupGarouSetupService } from '../setup/loup-garou-setup.service';
import { LOUP_GAROU_RULEBOOK } from '../rulebook/rulebook';

@Injectable()
export class LoupGarouActionService {
  constructor(
    private readonly players: PlayerStateService,
    private readonly actionLog: ActionLogService,
    private readonly setup: LoupGarouSetupService,
  ) {}

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const meta = this.setup.metadataOf(state);
    return LOUP_GAROU_RULEBOOK.getAvailableActions(state, meta, playerId);
  }

  validateActor(state: GameStateEntity, actorId: number | null): boolean {
    const meta = this.setup.metadataOf(state);
    return LOUP_GAROU_RULEBOOK.actorOverrideAllowed(state, meta, actorId);
  }

  handleAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const meta = this.setup.metadataOf(state);
    const actorIdRaw = (action.meta as any)?.actorId;
    const actorId =
      typeof actorIdRaw === 'number'
        ? actorIdRaw
        : (state.turn?.currentPlayerId ?? null);
    switch (meta.step) {
      case 'seer':
        return this.handleSeer(state, action, actorId);
      case 'cupid':
        return this.handleCupid(state, action, actorId);
      case 'wolves':
        return this.handleWolves(state, action, actorId);
      case 'witch':
        return this.handleWitch(state, action, actorId);
      case 'day-vote':
        return this.handleDayVote(state, action, actorId);
      default:
        return state;
    }
  }

  private handleSeer(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'seer_peek') return state;
    if (actorId == null) return state;
    const meta = this.setup.metadataOf(state);
    const seerId = actorId;
    const targetId = Number(action.payload?.targetId);
    const targetRole = meta.roles[targetId] as GarouRole | undefined;
    const updated: GarouMetadata = {
      ...meta,
      lastPeek: { seerId, targetId, role: targetRole ?? 'villager' },
      pending: { ...meta.pending, seerUsed: true },
      actionLog: this.actionLog.append(meta.actionLog, {
        step: meta.step,
        actorId: seerId,
        type: 'seer_peek',
        payload: { targetId },
      }),
    };
    return { ...state, metadata: updated };
  }

  private handleCupid(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'cupid_link') return state;
    const meta = this.setup.metadataOf(state);
    const a = Number(action.payload?.a);
    const b = Number(action.payload?.b);
    const updated: GarouMetadata = { ...meta, lovers: [a, b] };
    return { ...state, metadata: updated };
  }

  private handleWolves(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'wolves_choose') return state;
    const meta = this.setup.metadataOf(state);
    const targetId = Number(action.payload?.targetId);

    const choices = { ...(meta.pending.wolvesChoices ?? {}) };
    choices[actorId!] = targetId;
    const wolvesAlive = this.players
      .livingIds(state)
      .filter((id) => meta.roles[id] === 'werewolf');
    const votes = wolvesAlive.map((id) => choices[id]).filter((v) => v != null);
    let wolvesTarget: number | null = null;
    if (votes.length) {
      const tally = new Map<number, number>();
      votes.forEach((v) => tally.set(v, (tally.get(v) ?? 0) + 1));
      const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
      wolvesTarget = sorted[0]?.[0] ?? null;
    }

    const updated: GarouMetadata = {
      ...meta,
      pending: { ...meta.pending, wolvesChoices: choices, wolvesTarget },
      actionLog: this.actionLog.append(meta.actionLog, {
        step: meta.step,
        actorId,
        type: 'wolves_choose',
        payload: { targetId },
      }),
    };
    return { ...state, metadata: updated };
  }

  private handleWitch(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'witch_decide') return state;
    const meta = this.setup.metadataOf(state);
    const save = Boolean(action.payload?.save);
    const rawKill = action.payload?.killTargetId;
    const poisonTarget = rawKill == null ? null : Number(rawKill);

    let healUsed = meta.witchPotions.healUsed;
    let poisonUsed = meta.witchPotions.poisonUsed;
    let wolvesTarget = meta.pending.wolvesTarget;
    let appliedPoison: number | null = meta.pending.poisonTarget;

    if (save && !healUsed && wolvesTarget != null) {
      healUsed = true;
      wolvesTarget = null;
    }
    if (
      poisonTarget !== null &&
      !poisonUsed &&
      this.players.isAlive(state, poisonTarget)
    ) {
      poisonUsed = true;
      appliedPoison = poisonTarget;
    }

    const updatedMeta: GarouMetadata = {
      ...meta,
      pending: {
        ...meta.pending,
        wolvesTarget,
        poisonTarget: appliedPoison,
        witchUsed: true,
      },
      witchPotions: { healUsed, poisonUsed },
      actionLog: this.actionLog.append(meta.actionLog, {
        step: meta.step,
        actorId,
        type: 'witch_decide',
        payload: { save, poisonTarget: appliedPoison },
      }),
    };
    return { ...state, metadata: updatedMeta };
  }

  private handleDayVote(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'day_vote') return state;
    const meta = this.setup.metadataOf(state);
    const targetVal = action.payload?.targetId;
    const targetId =
      targetVal === null
        ? null
        : targetVal === undefined
          ? null
          : Number(targetVal);
    const normalized =
      targetId === null ? null : targetId >= 0 ? targetId : null;
    const updatedVotes = { ...meta.votes, [actorId!]: normalized };
    const living = this.players.livingIds(state);
    const allVoted = living.every((id) => updatedVotes[id] !== undefined);
    const nextState: GameStateEntity = {
      ...state,
      metadata: { ...meta, votes: updatedVotes },
      turn: {
        currentPlayerId: allVoted
          ? null
          : (state.turn?.currentPlayerId ?? null),
        direction: 1,
      },
    };
    return nextState;
  }
}
