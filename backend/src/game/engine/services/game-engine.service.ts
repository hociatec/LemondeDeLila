import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RoomService } from '../../../room/services/room.service';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameCoreService } from '../../core/services/game-core.service';
import { GameSingleActionDto, GameStateResponse, GameStateWithActions } from '../dto/game-action.dto';
import { GameRegistryService } from './game-registry.service';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { playingLog } from '../../../common/utils/playing-logger';
import { TurnLabelService } from '../../modules/turn/services/turn-label.service';
import { BotRunnerService } from '../../modules/bot/services/bot-runner.service';
import { BotSchedulerService } from '../../modules/bot/services/bot-scheduler.service';
import { GameEngineStateStore } from './game-engine-state.store';

@Injectable()
export class GameEngineService {
  private broadcaster?: (gameType: string, roomId: number, state: GameStateWithActions) => void;

  constructor(
    private readonly rooms: RoomService,
    private readonly core: GameCoreService,
    private readonly registry: GameRegistryService,
    private readonly turnLabel: TurnLabelService,
    private readonly botRunner: BotRunnerService,
    private readonly botScheduler: BotSchedulerService,
    private readonly store: GameEngineStateStore,
  ) {}

  setBroadcaster(fn: (gameType: string, roomId: number, state: GameStateWithActions) => void): void {
    this.broadcaster = fn;
  }

  async getState(roomId: number, gameType: string): Promise<GameStateWithActions> {
    const payload = await this.rooms.getRoomPayload(roomId);
    const existing = this.store.get(roomId, gameType);
    if (existing) {
      const synced = this.store.syncRoomStatus(existing, payload);
      const currentPlayers = existing.players?.length ?? 0;
      const incomingPlayers = (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
      const gameStarted = (existing.status || '').toLowerCase() === 'started';
      playingLog('engine.getState', {
        roomId,
        gameType,
        status: synced.status,
        turnIndex: synced.turnIndex,
        currentPlayerId: synced.turn?.currentPlayerId ?? null,
        players: synced.players?.map((p) => ({ id: p.id, isBot: (p as any).isBot })) ?? [],
        incomingPlayers,
        gameStarted,
      });
      if (!gameStarted && incomingPlayers !== currentPlayers) {
        const rebuilt = await this.buildInitialState(payload, gameType);
        const marked = this.markBotThinking(roomId, gameType, rebuilt);
        this.scheduleBotTurn(roomId, gameType, marked);
        return this.exposeState(marked, gameType);
      }
      const marked = this.markBotThinking(roomId, gameType, synced);
      this.scheduleBotTurn(roomId, gameType, marked);
      return this.exposeState(marked, gameType);
    }

    const state = await this.buildInitialState(payload, gameType);
    const marked = this.markBotThinking(roomId, gameType, state);
    this.scheduleBotTurn(roomId, gameType, marked);
    return this.exposeState(marked, gameType);
  }

  async applyActions(
    roomId: number,
    gameType: string,
    actions: GameSingleActionDto[],
    actorId: number | null,
    allowBotTurn = false,
  ): Promise<GameStateResponse> {
    const current = await this.getState(roomId, gameType);
    if ((current.status || '').toLowerCase() === 'finished') {
      return this.exposeState(current, gameType);
    }
    const handler = this.registry.getHandler(gameType);
    if (!allowBotTurn && (!actorId || Number.isNaN(actorId))) {
      throw new UnauthorizedException('Authentification requise pour jouer.');
    }
    if (!allowBotTurn && current.botThinking) {
      throw new UnauthorizedException('Un bot joue actuellement, merci de patienter.');
    }
    const currentPlayerId = current.turn?.currentPlayerId ?? null;
    const currentPlayer = current.players?.find((p) => p.id === currentPlayerId);
    const actorOverride = handler?.validateActor?.(current, actions, actorId ?? null) === true;
    if (!allowBotTurn && !actorOverride) {
      if (currentPlayer?.isBot) {
        throw new UnauthorizedException('Tour en cours : action réservée au bot.');
      }
      if (currentPlayerId !== actorId) {
        throw new UnauthorizedException("Ce n'est pas votre tour.");
      }
    }

    const actorLabel = allowBotTurn ? 'bot' : 'human';
    const sanitizedActions = Array.isArray(actions)
      ? actions.map((action) => ({
          ...action,
          meta: { ...(action?.meta ?? {}), actor: actorLabel },
        }))
      : [];

    playingLog('engine.applyActions.before', {
      roomId,
      gameType,
      actorId,
      allowBotTurn,
      status: current.status,
      turnIndex: current.turnIndex,
      currentPlayerId,
      actions: sanitizedActions.map((a) => ({ type: a.type, hasPayload: Boolean(a.payload) })),
    });

    if (!handler) {
      const next = this.core.appendLog(current, `Type de jeu non spécialisé: ${gameType}`);
      const marked = this.markBotThinking(roomId, gameType, next);
      this.scheduleBotTurn(roomId, gameType, marked);
      this.broadcaster?.(gameType, roomId, this.exposeState(marked, gameType));
      return this.exposeState(marked, gameType);
    }

    const next = await handler.applyActions(current, sanitizedActions);
    const botTurn = this.isBotTurn(next);
    const marked = this.markBotThinking(roomId, gameType, next, botTurn);
    this.scheduleBotTurn(roomId, gameType, marked);
    this.broadcaster?.(gameType, roomId, this.exposeState(marked, gameType));

    playingLog('engine.applyActions.after', {
      roomId,
      gameType,
      actorId,
      status: marked.status,
      turnIndex: marked.turnIndex,
      currentPlayerId: marked.turn?.currentPlayerId ?? null,
      isBotTurn: botTurn,
      botThinking: marked.botThinking ?? false,
    });

    return this.exposeState(marked, gameType);
  }

  async playBotTurn(roomId: number, gameType: string): Promise<GameStateWithActions> {
    playingLog('engine.bot.tick', { roomId, gameType });
    const state = await this.getState(roomId, gameType);
    const key = this.buildKey(roomId, gameType);
    this.botScheduler.clear(key);

    const handler = this.registry.getHandler(gameType);
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) {
      return this.exposeState(state, gameType);
    }

    let botActions =
      currentPlayerId != null ? this.botRunner.suggestForHandler(handler, state, currentPlayerId) : null;
    if (!botActions || botActions.length === 0) {
      const fallback =
        handler?.getAvailableActions && currentPlayerId != null ? handler.getAvailableActions(state, currentPlayerId) : [];
      if (Array.isArray(fallback) && fallback.length > 0 && currentPlayerId != null) {
        botActions = this.botRunner.choose(fallback, { state, playerId: currentPlayerId });
      }
    }
    if (!botActions || botActions.length === 0) {
      playingLog('engine.bot.noaction', { roomId, gameType, currentPlayerId, status: state.status });
      const marked = this.markBotThinking(roomId, gameType, state, false);
      this.broadcaster?.(gameType, roomId, this.exposeState(marked, gameType));
      return this.exposeState(marked, gameType);
    }

    playingLog('engine.bot.play', {
      roomId,
      gameType,
      currentPlayerId,
      isBot: currentPlayer.isBot,
      actions: botActions.map((a) => a.type),
      status: state.status,
    });

    const next = await this.applyActions(roomId, gameType, botActions, null, true);
    this.broadcaster?.(gameType, roomId, next);
    this.scheduleBotTurn(roomId, gameType, next);
    return this.exposeState(next, gameType);
  }

  private isBotTurn(state: GameStateEntity): boolean {
    if (state.status === 'finished') return false;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    return Boolean(currentPlayer?.isBot);
  }

  private scheduleBotTurn(roomId: number, gameType: string, state: GameStateEntity): void {
    const key = this.buildKey(roomId, gameType);
    const status = (state.status || '').toLowerCase();
    if (status === 'finished' || status === 'setup' || status === 'open' || status === 'pending' || status === 'preparing') {
      this.botScheduler.clear(key);
      return;
    }
    const blockingPending = (state as any).pending?.blocking === true;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    if (blockingPending && !currentPlayer?.isBot) {
      this.botScheduler.clear(key);
      return;
    }
    if (!currentPlayer || !currentPlayer.isBot) {
      this.botScheduler.clear(key);
      return;
    }
    if (this.botScheduler.has(key)) return;

    const delayMs = 4000;
    const thinking = { ...state, botThinking: true };
    this.store.set(roomId, gameType, thinking);
    this.broadcaster?.(gameType, roomId, this.exposeState(thinking, gameType));
    playingLog('engine.bot.schedule', {
      roomId,
      gameType,
      status: thinking.status,
      turnIndex: thinking.turnIndex,
      currentPlayerId: thinking.turn?.currentPlayerId ?? null,
      delayMs,
    });

    this.botScheduler.schedule({
      key,
      delayMs,
      roomId,
      gameType,
      run: async () => {
        await this.playBotTurn(roomId, gameType);
      },
      onStale: () => this.store.delete(roomId, gameType),
    });
  }

  async checkAccess(roomId: number, userId: number, ownerOnly = false): Promise<void> {
    const payload = await this.rooms.getRoomPayload(roomId);
    const isParticipant = payload.room.players.some((p) => p.id === userId);
    const isOwner = payload.room.owner?.id === userId;
    if (ownerOnly && !isOwner) {
      throw new UnauthorizedException('Seul le propriétaire peut effectuer cette action');
    }
    if (!ownerOnly && !isParticipant && !isOwner) {
      throw new UnauthorizedException("Accès non autorisé à cette table");
    }
  }

  private async buildInitialState(payload: RoomPayload, gameType: string): Promise<GameStateEntity> {
    const baseState = this.core.buildBaseState(payload, gameType);
    const handler = this.registry.getHandler(gameType);
    if (handler) {
      return handler.hydrateInitialState(baseState);
    }
    return this.core.appendLog(baseState, `Type de jeu non spécialisé: ${gameType}`);
  }

  private buildKey(roomId: number, gameType: string): string {
    return this.store.buildKey(roomId, gameType);
  }

  private markBotThinking(roomId: number, gameType: string, state: GameStateEntity, botTurn?: boolean): GameStateEntity {
    const isBot = botTurn !== undefined ? botTurn : this.isBotTurn(state);
    const marked = this.store.markBotThinking(state, isBot);
    this.store.set(roomId, gameType, marked);
    return marked;
  }

  private exposeState(state: GameStateEntity, gameType: string): GameStateWithActions {
    // Le label de tour doit rester aligné avec l'état interne (source de vérité),
    // même si exposeState() d'un jeu masque/transforme la liste des joueurs.
    const label = this.turnLabel.compute(state, gameType);
    const handler = this.registry.getHandler(gameType);
    const exposed = handler?.exposeState ? (handler.exposeState(state) as GameStateWithActions) : (state as GameStateWithActions);
    return this.attachTurnLabel(exposed, label);
  }

  private attachTurnLabel(state: GameStateWithActions, label: string | null): GameStateWithActions {
    if (!label) return state;
    const current = state.turn ?? null;
    if (!current) {
      return { ...state, turn: { currentPlayerId: null, direction: 1, label } };
    }
    return { ...state, turn: { ...current, label } };
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const message = err instanceof Error ? err.message : String(err ?? '');
    return message.includes('Room introuvable') || message.includes('Table introuvable');
  }
}
