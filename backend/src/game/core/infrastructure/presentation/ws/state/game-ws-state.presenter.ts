import { Injectable } from '@nestjs/common';
import type {
  GameRuntime,
  GameRuntimeDescriptor,
} from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import type { GameStateWithActions } from '../../../../application/contracts/game-action.model';
import type { GameShortcutHint } from '../../../../../shortcuts/public-api';
import { projectDiceActionView } from '../../../../../engine/runtime/projection/dice-action-view';
import { GameVisibilityService } from '../../../../application/services/game-visibility.service';
import { genericGameEventMessage } from './game-ws-generic-event-message';
import { cardMessageLabel, scalarMessageText } from './game-ws-message-values';

type PresentStateInput = {
  state: GameStateEntity;
  handler: GameRuntime;
  roomId: number;
  gameType: string;
  version: number;
  viewerPlayerId?: number | null;
};
type GamePresentationDescriptor = NonNullable<
  GameRuntimeDescriptor['presentation']
>;
type ScorePresentationDescriptor = NonNullable<
  GamePresentationDescriptor['score']
>;

@Injectable()
export class GameWsStatePresenter {
  constructor(private readonly visibility: GameVisibilityService) {}

  present(input: PresentStateInput): Record<string, unknown> {
    const exposedByGame = this.expose(
      input.handler,
      input.state,
      input.viewerPlayerId,
    );
    const exposed = projectDiceActionView(
      this.visibility.project(
        input.state,
        exposedByGame,
        Number(input.viewerPlayerId ?? 0) || null,
      ),
    );
    const presentation = this.presentation(input.handler);
    const kits = this.withScorePresentation(
      this.asRecord(exposed.kits),
      presentation.score,
      input.state.status,
    );
    const system = this.withServerMessages(
      this.asRecord(exposed.system),
      Number(input.viewerPlayerId ?? 0) || null,
      presentation,
    );
    return {
      ...exposed,
      kits,
      roomId: input.roomId,
      gameType: input.gameType,
      runId:
        typeof input.state.metadata?.roomRunId === 'number'
          ? input.state.metadata.roomRunId
          : 0,
      version: input.version,
      system: {
        ...system,
        shortcuts: this.resolveShortcuts(
          input.handler,
          input.state,
          exposed,
          kits,
        ),
      },
    };
  }

  private expose(
    handler: GameRuntime,
    state: GameStateEntity,
    viewerPlayerId?: number | null,
  ): GameStateWithActions {
    const viewerId = Number(viewerPlayerId ?? 0);
    if (Number.isFinite(viewerId) && viewerId > 0) {
      return handler.exposeStateForUser(state, viewerId);
    }
    return handler.exposeStateForUser(state, null);
  }

  private resolveShortcuts(
    handler: GameRuntime,
    state: GameStateEntity,
    exposed: GameStateWithActions,
    kits: Record<string, unknown>,
  ): GameShortcutHint[] {
    const declaredShortcuts = handler.getShortcuts({
      currentPlayerId: state.turn?.currentPlayerId ?? null,
      started: this.isActiveMatchStatus(state.status),
    });
    const score = this.asRecord(kits.score);
    const hasScore = Object.keys(score).length > 0;
    const shortcuts = declaredShortcuts.filter(
      (shortcut) =>
        !hasScore || this.stringValue(shortcut.key).toUpperCase() !== 'S',
    );
    if (hasScore) {
      shortcuts.push({
        key: 'S',
        type: 'interface',
        id: 'score',
        label: this.stringValue(score.label) || 'Scores',
      });
    }
    const rawActions = exposed.actions;
    const actions = (Array.isArray(rawActions) ? rawActions : []).map(
      (action) => this.asRecord(action),
    );
    const actionTypes = new Set(
      actions
        .map((action) => action.type)
        .filter((type): type is string => typeof type === 'string'),
    );
    return shortcuts
      .filter(
        (shortcut) =>
          (shortcut.type === 'interface' &&
            (shortcut.id !== 'score' ||
              Object.keys(this.asRecord(kits.score)).length > 0)) ||
          (shortcut.type === 'action' && actionTypes.has(shortcut.actionType)),
      )
      .map((shortcut) => {
        if (shortcut.label) return shortcut;
        if (shortcut.type === 'interface') return shortcut;
        const action = actions.find(
          (candidate) => candidate.type === shortcut.actionType,
        );
        const label =
          typeof action?.label === 'string' ? action.label.trim() : '';
        return label ? { ...shortcut, label } : shortcut;
      });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private presentation(handler: GameRuntime): GamePresentationDescriptor {
    if (typeof handler.getDescriptor !== 'function') return {};
    return handler.getDescriptor().presentation ?? {};
  }

  private withScorePresentation(
    kits: Record<string, unknown>,
    presentation?: ScorePresentationDescriptor,
    status?: unknown,
  ): Record<string, unknown> {
    if (
      presentation?.visibility === 'active-match' &&
      !this.isActiveMatchStatus(status)
    ) {
      return { ...kits, score: null };
    }
    const score = this.asRecord(kits.score);
    if (Object.keys(score).length === 0) return kits;
    return {
      ...kits,
      score: {
        ...score,
        label: presentation?.label ?? 'Scores',
        unit: presentation?.unit ?? { singular: 'point', plural: 'points' },
      },
    };
  }

  private withServerMessages(
    system: Record<string, unknown>,
    viewerPlayerId: number | null,
    presentation: GamePresentationDescriptor,
  ): Record<string, unknown> {
    const players = this.asRecord(system.players).all;
    const playerNames = new Map<number, string>();
    for (const value of Array.isArray(players) ? players : []) {
      const player = this.asRecord(value);
      const id = this.numberValue(player.id);
      const username = this.stringValue(player.username);
      if (id != null && username) playerNames.set(id, username);
    }

    const events = this.asRecord(system.events);
    const latestByType = this.asRecord(events.latestByType);
    const semanticMessageKey = this.stringValue(
      this.asRecord(this.asRecord(latestByType['game.message']).data).key,
    );
    const receivedCardData = this.asRecord(
      this.asRecord(latestByType['card.received']).data,
    );
    const recentEvents = Array.isArray(events.recent) ? events.recent : [];
    const pairedTurn = this.pairedTurnAfterSemanticMessage(
      recentEvents,
      this.asRecord(latestByType['game.message']),
      semanticMessageKey,
    );
    const started = this.isActiveMatchStatus(
      this.asRecord(system.match).status,
    );
    const presentEvent = (rawEvent: unknown): Record<string, unknown> => {
      const event = this.asRecord(rawEvent);
      const data = this.asRecord(event.data);
      const type = this.stringValue(event.type);
      const supersededByGameMessage =
        (type === 'card.drawn' && semanticMessageKey === 'game.card.drawn') ||
        (type === 'card.received' &&
          semanticMessageKey === 'game.card.drawn') ||
        (type === 'card.played' && semanticMessageKey === 'game.card.played') ||
        (type === 'turn.started' &&
          this.stringValue(event.id) === pairedTurn.eventId) ||
        (semanticMessageKey === 'game.round.started' &&
          (type === 'match.started' ||
            type === 'round.started' ||
            type === 'turn.started' ||
            type === 'card.drawn' ||
            type === 'card.received' ||
            type === 'card.discarded'));
      const message = supersededByGameMessage
        ? ''
        : this.eventMessage(
            type,
            data,
            this.numberValue(event.actorId),
            playerNames,
            started,
            viewerPlayerId,
            receivedCardData,
            pairedTurn.data,
            presentation,
          );
      return message ? { ...event, data: { ...data, message } } : event;
    };
    const presented: Record<string, unknown> = {};
    for (const [key, rawEvent] of Object.entries(latestByType)) {
      presented[key] = presentEvent(rawEvent);
    }
    const recent = recentEvents.map((event) => presentEvent(event));
    return {
      ...system,
      events: { ...events, recent, latestByType: presented },
    };
  }

  private eventMessage(
    type: string,
    data: Record<string, unknown>,
    actorId: number | null,
    players: ReadonlyMap<number, string>,
    started: boolean,
    viewerPlayerId: number | null,
    receivedCardData: Record<string, unknown>,
    nextTurnData: Record<string, unknown>,
    presentation: GamePresentationDescriptor,
  ): string {
    if (!started && (type === 'turn.started' || type === 'turn.ended'))
      return '';
    if (data.announce === false) return '';
    const explicit = this.stringValue(data.message);
    if (explicit) return explicit;

    const player = (value: unknown): string => {
      const id = this.numberValue(value);
      if (id == null) return '';
      return id === viewerPlayerId
        ? 'Vous'
        : (players.get(id) ?? `Joueur ${id}`);
    };
    if (type === 'game.message')
      return this.semanticMessage(
        data,
        player,
        players,
        receivedCardData,
        nextTurnData,
      );

    if (type === 'score.changed' && data.announce !== false)
      return this.scoreMessage(data, player, presentation.score);
    return genericGameEventMessage({
      type,
      data,
      actorId,
      players,
      viewerPlayerId,
    });
  }

  private semanticMessage(
    data: Record<string, unknown>,
    player: (value: unknown) => string,
    players: ReadonlyMap<number, string>,
    receivedCardData: Record<string, unknown>,
    nextTurnData: Record<string, unknown>,
  ): string {
    const messageKey = this.stringValue(data.key);
    const params = this.asRecord(data.params);
    const namedPlayer = player(params.playerId);
    const card =
      scalarMessageText(params.cardLabel) || scalarMessageText(params.cardId);
    if (messageKey === 'game.card.played' && namedPlayer)
      return `${namedPlayer} ${namedPlayer === 'Vous' ? 'jouez' : 'joue'} ${card || 'une carte'}.`;
    if (messageKey === 'game.card.drawn' && namedPlayer) {
      const drawnForPlayer = this.numberValue(params.playerId);
      const receivedByPlayer = this.numberValue(receivedCardData.playerId);
      const privateCard =
        namedPlayer === 'Vous' && drawnForPlayer === receivedByPlayer
          ? cardMessageLabel(receivedCardData.card)
          : '';
      return this.withNextTurn(
        `${namedPlayer} ${namedPlayer === 'Vous' ? 'piochez' : 'pioche'} ${privateCard || 'une carte'}.`,
        nextTurnData,
        players,
      );
    }
    if (messageKey === 'game.player.passed' && namedPlayer)
      return this.withNextTurn(
        namedPlayer === 'Vous'
          ? 'Vous passez votre tour.'
          : `${namedPlayer} passe son tour.`,
        nextTurnData,
        players,
      );
    if (messageKey !== 'game.round.started') return '';
    const round = scalarMessageText(params.round);
    const starterId = this.numberValue(params.starterPlayerId);
    const starter =
      starterId == null
        ? ''
        : (players.get(starterId) ?? `Joueur ${starterId}`);
    const messages = [
      round === '1'
        ? 'La partie démarre.'
        : round
          ? `La manche ${round} commence.`
          : 'Une nouvelle manche commence.',
      'Tout le monde reçoit son paquet de cartes.',
    ];
    if (starter) messages.push(`C'est au tour de ${starter}.`);
    return messages.join('\n');
  }

  private pairedTurnAfterSemanticMessage(
    recentEvents: unknown[],
    semanticEvent: Record<string, unknown>,
    semanticKey: string,
  ): { eventId: string; data: Record<string, unknown> } {
    if (
      semanticKey !== 'game.card.drawn' &&
      semanticKey !== 'game.player.passed'
    ) {
      return { eventId: '', data: {} };
    }
    const semanticId = this.stringValue(semanticEvent.id);
    const semanticIndex = recentEvents.findIndex(
      (rawEvent) => this.stringValue(this.asRecord(rawEvent).id) === semanticId,
    );
    if (!semanticId || semanticIndex < 0) return { eventId: '', data: {} };
    for (const rawEvent of recentEvents.slice(semanticIndex + 1)) {
      const event = this.asRecord(rawEvent);
      const type = this.stringValue(event.type);
      if (type === 'game.message') break;
      if (type === 'turn.started') {
        return {
          eventId: this.stringValue(event.id),
          data: this.asRecord(event.data),
        };
      }
    }
    return { eventId: '', data: {} };
  }

  private withNextTurn(
    message: string,
    nextTurnData: Record<string, unknown>,
    players: ReadonlyMap<number, string>,
  ): string {
    const playerId = this.numberValue(nextTurnData.playerId);
    if (playerId == null) return message;
    const name = players.get(playerId) ?? `Joueur ${playerId}`;
    return `${message}\nC'est au tour de ${name}.`;
  }

  private scoreMessage(
    data: Record<string, unknown>,
    player: (value: unknown) => string,
    presentation?: ScorePresentationDescriptor,
  ): string {
    const name = player(data.playerId);
    const value = scalarMessageText(data.value);
    const delta = this.numberValue(data.delta);
    if (
      presentation?.changeNarration === 'delta-and-total' &&
      name &&
      delta != null
    ) {
      if (delta > 0)
        return `${name} ${name === 'Vous' ? 'recevez' : 'reçoit'} ${delta} ${this.scoreUnit(presentation, delta)} et ${name === 'Vous' ? 'en avez' : 'en a'} maintenant ${value}.`;
      if (delta < 0)
        return `${name} ${name === 'Vous' ? 'rendez' : 'rend'} ${Math.abs(delta)} ${this.scoreUnit(presentation, Math.abs(delta))} et ${name === 'Vous' ? 'en avez' : 'en a'} maintenant ${value}.`;
      return '';
    }
    return name && value
      ? `${name} ${name === 'Vous' ? 'avez' : 'a'} maintenant ${value} ${this.scoreUnit(presentation, this.numberValue(data.value) ?? 0)}.`
      : '';
  }

  private scoreUnit(
    presentation: ScorePresentationDescriptor | undefined,
    value: number,
  ): string {
    const unit = presentation?.unit ?? {
      singular: 'point',
      plural: 'points',
    };
    return Math.abs(value) === 1 ? unit.singular : unit.plural;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isActiveMatchStatus(value: unknown): boolean {
    const status = this.stringValue(value).toLowerCase();
    return status === 'started' || status === 'playing';
  }

  private numberValue(value: unknown): number | null {
    const number = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(number) ? number : null;
  }
}
