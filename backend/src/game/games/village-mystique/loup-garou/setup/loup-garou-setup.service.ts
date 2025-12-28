import { Injectable } from '@nestjs/common';
import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../core/entities/game-state.entity';
import { RolesAssignmentService } from '../../../../modules/roles/services/roles-assignment.service';
import { PlayerStateService } from '../../../../modules/player/services/player-state.service';
import { TurnManagerService } from '../../../../modules/turn/services/turn-manager.service';
import type { BotProfile } from '../../../../modules/bot/services/bot-strategy.service';
import type {
  GarouMetadata,
  GarouRole,
  GarouStep,
} from '../model/loup-garou.types';
import { LOUP_GAROU_GAME } from '../definitions/game.definition';

@Injectable()
export class LoupGarouSetupService {
  constructor(
    private readonly roles: RolesAssignmentService,
    private readonly players: PlayerStateService,
    private readonly turns: TurnManagerService,
  ) {}

  metadataOf(state: GameStateEntity): GarouMetadata {
    return (state.metadata as GarouMetadata) ?? this.defaultMetadata();
  }

  ensureMetadata(state: GameStateEntity): GameStateEntity {
    const base = this.defaultMetadata();
    const meta = (state.metadata as GarouMetadata | undefined) ?? base;
    return {
      ...state,
      metadata: {
        ...base,
        ...meta,
        pending: { ...base.pending, ...meta.pending },
        witchPotions: { ...base.witchPotions, ...meta.witchPotions },
        votes: { ...base.votes, ...meta.votes },
        voteQueue: meta.voteQueue ?? base.voteQueue,
        nightDeaths: meta.nightDeaths ?? base.nightDeaths,
        lastAnnouncement: meta.lastAnnouncement ?? base.lastAnnouncement,
        actionLog: meta.actionLog ?? base.actionLog,
        botProfile: meta.botProfile ?? base.botProfile,
        victoryId: meta.victoryId ?? base.victoryId,
      } satisfies GarouMetadata,
    };
  }

  ensureRolesInitialized(
    state: GameStateEntity,
    params: { minPlayers: number; defaultBotProfile: BotProfile },
  ): GameStateEntity {
    const ensured = this.ensureMetadata(state);
    const meta = this.metadataOf(ensured);
    const hasRoles = meta.roles && Object.keys(meta.roles).length > 0;
    if (hasRoles) return ensured;

    const players = this.players.ensureAliveFlag(ensured.players ?? []);
    const roles = this.assignRoles(players);
    const nextMeta: GarouMetadata = {
      ...this.defaultMetadata(),
      ...meta,
      roles,
      botProfile:
        (ensured.metadata as any)?.botProfile ?? params.defaultBotProfile,
    };
    const seerId = this.findRolePlayer('seer', nextMeta);
    const next: GameStateEntity = this.ensureMetadata({
      ...ensured,
      players,
      metadata: nextMeta,
      turn: { currentPlayerId: seerId ?? null, direction: 1 },
      turnIndex:
        (typeof ensured.turnIndex === 'number' && ensured.turnIndex >= 0) ||
        players.length < params.minPlayers
          ? ensured.turnIndex
          : 0,
    });
    return next;
  }

  hydrateInitialState(
    baseState: GameStateEntity,
    params: { minPlayers: number; defaultBotProfile: BotProfile },
  ): GameStateEntity {
    const players = this.players.ensureAliveFlag(baseState.players ?? []);
    const status = (baseState.status || 'open').toLowerCase();

    if (status !== 'started' && status !== 'starting') {
      return this.ensureMetadata({
        ...baseState,
        status: baseState.status ?? 'open',
        players,
      });
    }

    const roles = this.assignRoles(players ?? []);
    const metadata: GarouMetadata = {
      ...this.defaultMetadata(),
      roles,
      botProfile:
        (baseState.metadata as any)?.botProfile ?? params.defaultBotProfile,
    };

    const canStart = players.length >= params.minPlayers;
    const seerId = this.findRolePlayer('seer', metadata);
    return this.ensureMetadata({
      ...baseState,
      status: canStart ? 'started' : (baseState.status ?? 'open'),
      players,
      metadata,
      turn: {
        currentPlayerId: canStart ? (seerId ?? null) : null,
        direction: 1,
      },
      turnIndex: canStart ? 0 : -1,
    });
  }

  assignRoles(players: PlayerStateEntity[]): Record<number, GarouRole> {
    const ids = players.map((p) => p.id).filter((id) => typeof id === 'number');
    const prioritized = LOUP_GAROU_GAME.roleDistribution(ids.length);
    return this.roles.assign<GarouRole>(ids, prioritized, 'villager');
  }

  roleHolders(meta: GarouMetadata, role: GarouRole): number[] {
    return Object.entries(meta.roles)
      .filter(([, r]) => r === role)
      .map(([id]) => parseInt(id, 10))
      .filter((id) => Number.isFinite(id));
  }

  uniqueRoleHolder(
    state: GameStateEntity,
    meta: GarouMetadata,
    role: GarouRole,
  ): number | null {
    const def = LOUP_GAROU_GAME.roles.find((r) => r.id === role);
    if (!def?.unique) return null;
    const holders = this.roleHolders(meta, role).filter((id) =>
      this.players.isAlive(state, id),
    );
    return holders[0] ?? null;
  }

  findRolePlayer(role: GarouRole, meta: GarouMetadata): number | null {
    // Kept for backwards-compat usages where the role is expected to be unique.
    // If the role is not unique in the model, return the first living holder as a "turn owner".
    const holders = this.roleHolders(meta, role);
    return holders[0] ?? null;
  }

  isRole(meta: GarouMetadata, playerId: number, role: GarouRole): boolean {
    return meta.roles[playerId] === role;
  }

  witchLocked(meta: GarouMetadata): boolean {
    return meta.witchPotions.healUsed && meta.witchPotions.poisonUsed;
  }

  hasWerewolvesAlive(state: GameStateEntity, meta: GarouMetadata): boolean {
    return this.players
      .livingIds(state)
      .some((id) => meta.roles[id] === 'werewolf');
  }

  withStep(state: GameStateEntity, step: GarouStep): GameStateEntity {
    const meta = this.metadataOf(state);
    return {
      ...state,
      metadata: {
        ...meta,
        step,
        pending: {
          ...meta.pending,
          seerUsed: step === 'seer' ? meta.pending.seerUsed : false,
        },
      } satisfies GarouMetadata,
    };
  }

  withTurn(state: GameStateEntity, playerId: number | null): GameStateEntity {
    return this.turns.setCurrent(state, playerId);
  }

  defaultMetadata(): GarouMetadata {
    return {
      day: 1,
      firstNight: true,
      step: 'seer',
      roles: {},
      lovers: null,
      pending: {
        wolvesChoices: {},
        wolvesTarget: null,
        poisonTarget: null,
        seerUsed: false,
        witchUsed: false,
      },
      witchPotions: { healUsed: false, poisonUsed: false },
      votes: {},
      voteQueue: [],
      nightDeaths: [],
      lastAnnouncement: [],
      tiePolicy: 'no-kill',
      actionLog: [],
      botProfile: 'greedy',
      victoryId: null,
    };
  }
}
