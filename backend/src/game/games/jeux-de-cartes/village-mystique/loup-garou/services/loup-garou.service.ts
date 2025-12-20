import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../../core/entities/game-state.entity';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../../engine/services/game-registry.service';
import { RolesAssignmentService } from '../../../../../modules/roles/services/roles-assignment.service';
import { VoteService } from '../../../../../modules/vote/services/vote.service';
import { PlayerStateService } from '../../../../../modules/player/services/player-state.service';
import { TurnManagerService } from '../../../../../modules/turn/services/turn-manager.service';
import {
  ActionLogService,
  ActionLogEntry,
} from '../../../../../modules/actionlog/services/action-log.service';
import { ActionResolverService } from '../../../../../modules/action-resolver/services/action-resolver.service';
import {
  PhaseEngineService,
  PhaseDefinition,
} from '../../../../../modules/state/services/phase-engine.service';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { BotProfile } from '../../../../../modules/bot/services/bot-strategy.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import {
  LOUP_GAROU_PHASES,
  LOUP_GAROU_ROLES,
} from '../definitions/rules.definition';
import { LOUP_GAROU_VICTORY } from '../definitions/victory.definition';

type GarouRole = 'werewolf' | 'seer' | 'witch' | 'cupid' | 'villager';
type GarouStep =
  | 'seer'
  | 'cupid'
  | 'wolves'
  | 'witch'
  | 'resolve-night'
  | 'announce'
  | 'day-vote'
  | 'resolve-day'
  | 'check-victory';

type GarouWinner = 'village' | 'wolves' | 'lovers';

type GarouMetadata = {
  day: number;
  firstNight: boolean;
  step: GarouStep;
  roles: Record<number, GarouRole>;
  lovers: [number, number] | null;
  pending: {
    wolvesChoices: Record<number, number | null>;
    wolvesTarget: number | null;
    poisonTarget: number | null;
    seerUsed: boolean;
  };
  witchPotions: { healUsed: boolean; poisonUsed: boolean };
  votes: Record<number, number | null>;
  voteQueue: number[];
  nightDeaths: number[];
  lastAnnouncement: number[];
  winner?: GarouWinner | null;
  lastPeek?: { seerId: number; targetId: number; role: GarouRole };
  tiePolicy: 'no-kill' | 'random';
  actionLog: ActionLogEntry[];
  botProfile?: BotProfile;
  victoryId?: string | null;
};

@Injectable()
export class LoupGarouService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'loup-garou';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VillageMystique';
  readonly displayName = 'Loup Garou';
  readonly description = 'Déduction sociale avec phases nuit/jour.';
  readonly minPlayers = 6;
  readonly maxPlayers = 12;

  constructor(
    private readonly core: GameCoreService,
    private readonly registry: GameRegistryService,
    private readonly roles: RolesAssignmentService,
    private readonly voteService: VoteService,
    private readonly players: PlayerStateService,
    private readonly turns: TurnManagerService,
    private readonly actionLog: ActionLogService,
    private readonly actionResolver: ActionResolverService,
    private readonly phaseEngine: PhaseEngineService<GarouMetadata>,
    private readonly botRunner: BotRunnerService,
    private readonly victory: VictoryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const roles = this.assignRoles(baseState.players ?? []);
    const players = this.players.ensureAliveFlag(baseState.players ?? []);
    const metadata: GarouMetadata = {
      day: 1,
      firstNight: true,
      step: 'seer',
      roles,
      lovers: null,
      pending: {
        wolvesChoices: {},
        wolvesTarget: null,
        poisonTarget: null,
        seerUsed: false,
      },
      witchPotions: { healUsed: false, poisonUsed: false },
      votes: {},
      voteQueue: [],
      nightDeaths: [],
      lastAnnouncement: [],
      tiePolicy: 'no-kill',
      actionLog: [],
      botProfile: (baseState.metadata as any)?.botProfile ?? 'greedy',
    };
    const status = (baseState.status || 'open').toLowerCase();
    const canStart = players.length >= this.minPlayers && status === 'starting';
    let state: GameStateEntity = {
      ...baseState,
      status: canStart ? 'started' : (baseState.status ?? 'open'),
      players,
      metadata,
      turn: {
        currentPlayerId: canStart
          ? (this.findRolePlayer('seer', metadata) ?? null)
          : null,
        direction: 1,
      },
      turnIndex: canStart ? 0 : -1,
    };
    if (canStart) {
      state = this.advanceState(state);
    }
    return state;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.ensureMetadata(state);
    const status = (next.status || '').toLowerCase();
    const canStart =
      (next.players?.length ?? 0) >= this.minPlayers && status === 'starting';
    if (status !== 'started' && canStart) {
      next = {
        ...next,
        status: 'started',
        turn: {
          currentPlayerId:
            this.findRolePlayer('seer', this.metadataOf(next)) ?? null,
          direction: 1,
        },
        turnIndex: 0,
      };
      next = this.advanceState(next);
    }
    if ((next.status || '').toLowerCase() !== 'started') {
      return next;
    }
    next = this.actionResolver.apply(next, actions, (s, a) =>
      this.handleAction(s, a),
    );
    next = this.advanceState(next);
    const current = next.turn?.currentPlayerId ?? null;
    const isBot =
      (next.players ?? []).find((p) => p.id === current)?.isBot ?? false;
    next = { ...next, botThinking: Boolean(isBot) };
    return next;
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const meta = this.metadataOf(state);
    const profile = meta.botProfile ?? 'greedy';
    const actions = this.getAvailableActions(state, botPlayerId);
    const step = meta.step;
    const prefer =
      step === 'seer'
        ? ['seer_peek']
        : step === 'cupid'
          ? ['cupid_link']
          : step === 'wolves'
            ? ['wolves_choose']
            : step === 'witch'
              ? ['witch_decide']
              : step === 'day-vote'
                ? ['day_vote']
                : [];
    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      profile,
      {
        preferTypes: prefer,
        fallbackTypes: ['day_vote', 'roll'],
      },
    );
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const meta = this.metadataOf(state);
    const alive = this.players.isAlive(state, playerId);
    if (!alive || meta.winner) return [];

    const step = meta.step;
    switch (step) {
      case 'seer':
        if (this.isRole(meta, playerId, 'seer')) {
          return this.buildPeekActions(state, playerId);
        }
        return [];
      case 'cupid':
        if (meta.firstNight && this.isRole(meta, playerId, 'cupid')) {
          return this.buildCupidActions(state, playerId);
        }
        return [];
      case 'wolves': {
        const wolf = this.findRolePlayer('werewolf', meta);
        if (wolf === playerId && this.hasWerewolvesAlive(state, meta)) {
          return this.buildWolfActions(state, playerId);
        }
        return [];
      }
      case 'witch': {
        const witch = this.findRolePlayer('witch', meta);
        if (witch === playerId && !this.witchLocked(meta)) {
          return this.buildWitchActions(state, playerId);
        }
        return [];
      }
      case 'day-vote': {
        const current = state.turn?.currentPlayerId ?? null;
        if (current === playerId) {
          return this.buildVoteActions(state, playerId);
        }
        return [];
      }
      default:
        return [];
    }
  }

  private handleAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const meta = this.metadataOf(state);
    const actorId = state.turn?.currentPlayerId ?? null;
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

  validateActor(
    state: GameStateEntity,
    _actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    if (actorId == null) return false;
    const meta = this.metadataOf(state);
    if (!this.players.isAlive(state, actorId)) return false;
    switch (meta.step) {
      case 'wolves':
        return meta.roles[actorId] === 'werewolf';
      case 'day-vote':
        return true; // votes simultanés autorisés
      default:
        return false;
    }
  }

  private handleSeer(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'seer_peek') return state;
    const meta = this.metadataOf(state);
    if (meta.pending.seerUsed) return state;
    const seerId = this.findRolePlayer('seer', meta);
    if (
      seerId == null ||
      seerId !== actorId ||
      !this.players.isAlive(state, seerId)
    )
      return state;
    const targetId = Number(action.payload?.targetId);
    if (Number.isNaN(targetId)) return state;
    if (!this.players.isAlive(state, targetId)) return state;
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
    const meta = this.metadataOf(state);
    const cupidId = this.findRolePlayer('cupid', meta);
    if (
      meta.firstNight !== true ||
      cupidId == null ||
      cupidId !== actorId ||
      !this.players.isAlive(state, cupidId)
    ) {
      return state;
    }
    const a = Number(action.payload?.a);
    const b = Number(action.payload?.b);
    if (Number.isNaN(a) || Number.isNaN(b)) return state;
    if (
      !this.players.isAlive(state, a) ||
      !this.players.isAlive(state, b) ||
      a === b
    )
      return state;
    const updated: GarouMetadata = { ...meta, lovers: [a, b] };
    return { ...state, metadata: updated };
  }

  private handleWolves(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) {
    if (action.type !== 'wolves_choose') return state;
    const meta = this.metadataOf(state);
    if (
      !this.players.isAlive(state, actorId) ||
      meta.roles[actorId!] !== 'werewolf'
    ) {
      return state;
    }
    const targetId = Number(action.payload?.targetId);
    if (Number.isNaN(targetId) || !this.players.isAlive(state, targetId))
      return state;

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
    const meta = this.metadataOf(state);
    const witch = this.findRolePlayer('witch', meta);
    if (
      witch == null ||
      witch !== actorId ||
      !this.players.isAlive(state, witch) ||
      this.witchLocked(meta)
    ) {
      return state;
    }
    const save = Boolean(action.payload?.save);
    const rawKill = action.payload?.killTargetId;
    const poisonTarget = rawKill == null ? null : Number(rawKill);
    if (poisonTarget !== null && Number.isNaN(poisonTarget)) return state;

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
      pending: { ...meta.pending, wolvesTarget, poisonTarget: appliedPoison },
      witchPotions: { healUsed, poisonUsed },
      actionLog: this.actionLog.append(meta.actionLog, {
        step: meta.step,
        actorId: witch,
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
    const meta = this.metadataOf(state);
    if (!this.players.isAlive(state, actorId)) return state;
    const targetVal = action.payload?.targetId;
    const targetId =
      targetVal === null
        ? null
        : targetVal === undefined
          ? null
          : Number(targetVal);
    if (targetId !== null && Number.isNaN(targetId)) return state;
    if (
      targetId !== null &&
      targetId >= 0 &&
      !this.players.isAlive(state, targetId)
    )
      return state;
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
    return allVoted ? this.resolveDay(nextState) : nextState;
  }

  private advanceState(state: GameStateEntity): GameStateEntity {
    let current = this.ensureMetadata(state);
    let phaseId = this.metadataOf(current).step;
    const phases = this.buildPhases();
    let safety = 0;
    while (safety++ < 20) {
      const meta = this.metadataOf(current);
      if (meta.winner) return { ...current, status: 'finished' };
      const advanced = this.phaseEngine.advance(current, meta, phases, phaseId);
      current = advanced.state;
      const newMeta = this.metadataOf(current);
      phaseId = advanced.phaseId as GarouStep;
      if (newMeta.step !== phaseId) {
        current = this.withStep(current, phaseId);
      }
      // Si on est sur une phase qui attend une action, on s'arrête ici.
      if (['seer', 'cupid', 'wolves', 'witch', 'day-vote'].includes(phaseId)) {
        return current;
      }
      // Sinon, on boucle pour les phases automatiques (resolve/announce/check/transition)
      continue;
    }
    this.core.appendLog?.(
      current,
      '[LoupGarou] Avertissement: boucle de progression interrompue.',
    );
    return current;
  }

  private buildPhases(): PhaseDefinition<GarouMetadata>[] {
    return [
      {
        id: 'seer',
        canEnter: (_s, m) =>
          Boolean(this.findRolePlayer('seer', m) && !m.pending.seerUsed),
        onEnter: (s, m) => this.withTurn(s, this.findRolePlayer('seer', m)),
      },
      {
        id: 'cupid',
        canEnter: (_s, m) =>
          m.firstNight && Boolean(this.findRolePlayer('cupid', m)),
        onEnter: (s, m) => this.withTurn(s, this.findRolePlayer('cupid', m)),
      },
      {
        id: 'wolves',
        canEnter: (s, m) => this.hasWerewolvesAlive(s, m),
        onEnter: (s, m) => this.withTurn(s, this.findRolePlayer('werewolf', m)),
      },
      {
        id: 'witch',
        canEnter: (s, m) => {
          const w = this.findRolePlayer('witch', m);
          return Boolean(
            w && this.players.isAlive(s, w) && !this.witchLocked(m),
          );
        },
        onEnter: (s, m) => this.withTurn(s, this.findRolePlayer('witch', m)),
      },
      {
        id: 'resolve-night',
        onEnter: (s) => this.resolveNight(s),
      },
      {
        id: 'announce',
        onEnter: (s) => s,
      },
      {
        id: 'day-vote',
        onEnter: (s, m) => {
          const living = this.players.livingIds(s);
          const pending = living.filter((id) => m.votes[id] === undefined);
          return this.withTurn(s, pending[0] ?? null);
        },
      },
      {
        id: 'resolve-day',
        onEnter: (s) => this.resolveDay(s),
      },
      {
        id: 'check-victory',
        onEnter: (s) => {
          const result = this.victory.evaluate(s, LOUP_GAROU_VICTORY);
          if (result?.finished) {
            const winner = (result.winnerId as GarouWinner | null) ?? null;
            const metaWithWinner: GarouMetadata = {
              ...this.metadataOf(s),
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
    ];
  }

  private resolveNight(state: GameStateEntity): GameStateEntity {
    const meta = this.metadataOf(state);
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
      ...this.metadataOf(next),
      nightDeaths: unique,
      lastAnnouncement: unique,
      pending: {
        wolvesChoices: {},
        wolvesTarget: null,
        poisonTarget: null,
        seerUsed: false,
      },
      actionLog: this.actionLog.append(this.metadataOf(next).actionLog, {
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

  private resolveDay(state: GameStateEntity): GameStateEntity {
    const meta = this.metadataOf(state);
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
      ...this.metadataOf(next),
      voteQueue: [],
      votes: {},
      lastAnnouncement: executed != null ? [executed] : [],
      actionLog: this.actionLog.append(this.metadataOf(next).actionLog, {
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

  private startNextNight(state: GameStateEntity): GameStateEntity {
    const meta = this.metadataOf(state);
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
      },
      nightDeaths: [],
      lastAnnouncement: [],
    };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      turn: {
        currentPlayerId: this.findRolePlayer('seer', nextMeta) ?? null,
        direction: 1,
      },
    };
    return this.advanceState(nextState);
  }

  private assignRoles(players: PlayerStateEntity[]): Record<number, GarouRole> {
    const ids = players.map((p) => p.id).filter((id) => typeof id === 'number');
    const prioritized: GarouRole[] = [];
    if (ids.length >= 6) {
      prioritized.push('seer', 'witch', 'cupid', 'werewolf');
      if (ids.length >= 8) prioritized.push('werewolf');
    }
    return this.roles.assign<GarouRole>(ids, prioritized, 'villager');
  }

  private findRolePlayer(role: GarouRole, meta: GarouMetadata): number | null {
    const entry = Object.entries(meta.roles).find(([_, r]) => r === role);
    return entry ? parseInt(entry[0], 10) : null;
  }

  private hasWerewolvesAlive(
    state: GameStateEntity,
    meta: GarouMetadata,
  ): boolean {
    return this.players
      .livingIds(state)
      .some((id) => meta.roles[id] === 'werewolf');
  }

  private withStep(state: GameStateEntity, step: GarouStep): GameStateEntity {
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
      },
    };
  }

  private withTurn(
    state: GameStateEntity,
    playerId: number | null,
  ): GameStateEntity {
    return this.turns.setCurrent(state, playerId);
  }

  private metadataOf(state: GameStateEntity): GarouMetadata {
    return (state.metadata as GarouMetadata) ?? this.defaultMetadata();
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
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
      },
    };
  }

  private defaultMetadata(): GarouMetadata {
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
      },
      witchPotions: { healUsed: false, poisonUsed: false },
      votes: {},
      voteQueue: [],
      nightDeaths: [],
      lastAnnouncement: [],
      tiePolicy: 'no-kill',
      actionLog: [] as ActionLogEntry[],
      botProfile: 'greedy',
      victoryId: null,
    };
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const currentId = state.turn?.currentPlayerId ?? null;
    const actions =
      typeof currentId === 'number'
        ? this.getAvailableActions(state, currentId)
        : [];
    const meta = this.metadataOf(state);
    const roleCatalog = LOUP_GAROU_ROLES;
    const phasesCatalog = LOUP_GAROU_PHASES.map((p) => p.id);
    const pending =
      meta.step === 'day-vote'
        ? { type: 'vote', name: meta.step, day: meta.day }
        : { type: 'phase', name: meta.step, day: meta.day };
    return {
      ...(state as any),
      catalog: {
        roles: roleCatalog,
        phases: phasesCatalog,
        victory: LOUP_GAROU_VICTORY,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending,
    };
  }

  private isRole(
    meta: GarouMetadata,
    playerId: number,
    role: GarouRole,
  ): boolean {
    return meta.roles[playerId] === role;
  }

  private witchLocked(meta: GarouMetadata): boolean {
    return meta.witchPotions.healUsed && meta.witchPotions.poisonUsed;
  }

  private buildPeekActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const targets = this.players
      .livingIds(state)
      .filter((id) => id !== playerId);
    return targets.map((id) => ({
      type: 'seer_peek',
      payload: { targetId: id },
    }));
  }

  private buildCupidActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const targets = this.players
      .livingIds(state)
      .filter((id) => id !== playerId);
    const actions: GameSingleActionDto[] = [];
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        actions.push({
          type: 'cupid_link',
          payload: { a: targets[i], b: targets[j] },
        });
      }
    }
    return actions;
  }

  private buildWolfActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const targets = this.players
      .livingIds(state)
      .filter((id) => id !== playerId);
    return targets.map((id) => ({
      type: 'wolves_choose',
      payload: { targetId: id },
    }));
  }

  private buildWitchActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const meta = this.metadataOf(state);
    const actions: GameSingleActionDto[] = [];
    const wolvesTarget = meta.pending.wolvesTarget;
    if (!meta.witchPotions.healUsed && wolvesTarget != null) {
      actions.push({
        type: 'witch_decide',
        payload: { save: true, killTargetId: null },
      });
    }
    if (!meta.witchPotions.poisonUsed) {
      const targets = this.players
        .livingIds(state)
        .filter((id) => id !== playerId);
      targets.forEach((t) =>
        actions.push({
          type: 'witch_decide',
          payload: { save: false, killTargetId: t },
        }),
      );
    }
    if (actions.length === 0) {
      actions.push({
        type: 'witch_decide',
        payload: { save: false, killTargetId: null },
      });
    }
    return actions;
  }

  private buildVoteActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    const targets = this.players
      .livingIds(state)
      .filter((id) => id !== playerId);
    const actions = targets.map((id) => ({
      type: 'day_vote',
      payload: { targetId: id },
    }));
    actions.push({ type: 'day_vote', payload: { targetId: -1 } }); // abstain (encoded as -1)
    return actions;
  }
}
