import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RoomService } from '../../../room/services/room.service';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameCoreService } from '../../core/services/game-core.service';
import { GameSingleActionDto, GameStateResponse, GameStateWithActions } from '../dto/game-action.dto';
import { GameRegistryService } from './game-registry.service';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import type { BotStrategy, GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { playingLog } from '../../../common/utils/playing-logger';

@Injectable()
export class GameEngineService {
  private readonly states = new Map<string, GameStateEntity>();
  private readonly botTimers = new Map<string, NodeJS.Timeout>();
  private broadcaster?: (gameType: string, roomId: number, state: GameStateWithActions) => void;

  constructor(
    private readonly rooms: RoomService,
    private readonly core: GameCoreService,
    private readonly registry: GameRegistryService,
  ) {}

  setBroadcaster(
    fn: (gameType: string, roomId: number, state: GameStateWithActions) => void,
  ): void {
    this.broadcaster = fn;
  }

  async getState(roomId: number, gameType: string): Promise<GameStateWithActions> {
    const key = this.buildKey(roomId, gameType);
    const payload = await this.rooms.getRoomPayload(roomId);
    const existing = this.states.get(key);
    if (existing) {
      const synced = this.syncRoomStatus(existing, payload);
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
      // Si la table n'est pas démarrée et que la composition a changé, on reconstruit l'état initial.
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
        throw new UnauthorizedException('Ce n’est pas votre tour.');
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
      isBotTurn: Boolean(currentPlayer?.isBot),
      botThinking: current.botThinking ?? false,
      actions: sanitizedActions.map((a) => ({ type: a.type, meta: a.meta })),
    });

    let next = this.core.cloneState(current);
    next.botThinking = false;
    if (handler) {
      next = handler.applyActions(next, sanitizedActions);
    } else if (Array.isArray(sanitizedActions)) {
      sanitizedActions.forEach((action) => {
        if (!action || !action.type) return;
        next = this.core.appendLog(next, `Action reçue: ${action.type}`);
      });
    }

    const botTurn = this.isBotTurn(next);
    const marked = this.markBotThinking(roomId, gameType, next, botTurn);
    this.scheduleBotTurn(roomId, gameType, marked);
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
    this.clearBotTimer(key);
    const handler = this.registry.getHandler(gameType);
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) {
      return this.exposeState(state, gameType);
    }

    let botActions =
      currentPlayerId != null ? this.suggestBotActions(handler, state, currentPlayerId) : null;
    if (!botActions || botActions.length === 0) {
      // Tentative de secours : prendre la première action disponible si le handler l'expose.
      const fallback =
        handler?.getAvailableActions && currentPlayerId != null
          ? handler.getAvailableActions(state, currentPlayerId)
          : [];
      if (Array.isArray(fallback) && fallback.length > 0) {
        botActions = [fallback[0]];
      }
    }
    if (!botActions || botActions.length === 0) {
      const logged = this.core.appendLog(state, 'Aucune action bot disponible, passage automatique.');
      // Passage de tour implicite : on stocke l'état et on planifie le prochain tick sans bloquer.
      const marked = this.markBotThinking(roomId, gameType, logged, false);
      this.states.set(key, marked);
      this.broadcaster?.(gameType, roomId, this.exposeState(marked, gameType));
      this.scheduleBotTurn(roomId, gameType, marked);
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

  private suggestBotActions(
    handler: GameRulesAdapter | undefined,
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    if (handler?.getBotActions) {
      return handler.getBotActions(state, botPlayerId) ?? null;
    }
    const strategy: BotStrategy | null | undefined = handler?.getBotStrategy ? handler.getBotStrategy() : null;
    if (strategy?.suggest) {
      return strategy.suggest(state, botPlayerId);
    }
    return null;
  }

  async getAvailableActions(roomId: number, gameType: string, playerId: number): Promise<GameSingleActionDto[]> {
    const state = await this.getState(roomId, gameType);
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentPlayerId);
    if (currentPlayer?.isBot && currentPlayer.id !== playerId) {
      return [];
    }
    const handler = this.registry.getHandler(gameType);
    if (handler?.getAvailableActions) {
      return handler.getAvailableActions(state, playerId) ?? [];
    }
    return [];
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
      this.clearBotTimer(key);
      return;
    }
    const blockingPending = (state as any).pending?.blocking === true;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer = state.players?.find((p) => p.id === currentId);
    if (blockingPending && !currentPlayer?.isBot) {
      this.clearBotTimer(key);
      return;
    }
    if (!currentPlayer || !currentPlayer.isBot) {
      this.clearBotTimer(key);
      return;
    }
    // Si un timer est déjà armé pour ce bot, ne pas le réinitialiser à chaque getState.
    if (this.botTimers.has(key)) {
      return;
    }
    // Délai artificiel pour laisser le bot "réfléchir" côté serveur.
    const delayMs = 4000;
    const thinking = { ...state, botThinking: true };
    this.states.set(key, thinking);
    this.broadcaster?.(gameType, roomId, thinking);
    playingLog('engine.bot.schedule', {
      roomId,
      gameType,
      status: thinking.status,
      turnIndex: thinking.turnIndex,
      currentPlayerId: thinking.turn?.currentPlayerId ?? null,
      delayMs,
    });
    const timer = setTimeout(() => {
      playingLog('engine.bot.timer', { roomId, gameType });
      this.playBotTurn(roomId, gameType).catch((err) => {
        playingLog('engine.bot.error', {
          roomId,
          gameType,
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }, delayMs);
    this.botTimers.set(key, timer);
  }

  private clearBotTimer(key: string): void {
    const timer = this.botTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(key);
    }
  }

  async checkAccess(roomId: number, userId: number, ownerOnly = false): Promise<void> {
    const payload = await this.rooms.getRoomPayload(roomId);
    const isParticipant = payload.room.players.some((p) => p.id === userId);
    const isOwner = payload.room.owner?.id === userId;
    if (ownerOnly && !isOwner) {
      throw new UnauthorizedException('Seul le propriétaire peut effectuer cette action');
    }
    if (!ownerOnly && !isParticipant && !isOwner) {
      throw new UnauthorizedException('Accès non autorisé à cette table');
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
    return `${gameType}:${roomId}`;
  }

  private markBotThinking(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    botTurn?: boolean,
  ): GameStateEntity {
    const isBot = botTurn !== undefined ? botTurn : this.isBotTurn(state);
    const marked = { ...state, botThinking: isBot };
    const key = this.buildKey(roomId, gameType);
    this.states.set(key, marked);
    return marked;
  }

  private syncRoomStatus(state: GameStateEntity, payload: RoomPayload): GameStateEntity {
    const payloadStatus = payload?.room?.status;
    if (!payloadStatus || payloadStatus === state.status) {
      return state;
    }
    // Ne pas rétrograder un état déjà démarré vers setup/open si le payload n'est pas à jour.
    if ((state.status || '').toLowerCase() === 'started' && payloadStatus !== 'finished') {
      return state;
    }
    return { ...state, status: payloadStatus };
  }

  private exposeState(state: GameStateEntity, gameType: string): GameStateWithActions {
    const handler = this.registry.getHandler(gameType);
    if (handler?.exposeState) {
      return handler.exposeState(state) as GameStateWithActions;
    }
    return state as GameStateWithActions;
  }
}
