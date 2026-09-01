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
    );
    const system = this.withServerMessages(
      this.asRecord(exposed.system),
      Number(input.viewerPlayerId ?? 0) || null,
      presentation,
      kits,
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
        shortcuts: this.resolveShortcuts(input.handler, input.state, exposed),
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
  ): GameShortcutHint[] {
    const shortcuts = handler.getShortcuts({
      currentPlayerId: state.turn?.currentPlayerId ?? null,
      started: String(state.status ?? '').toLowerCase() === 'started',
    });
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
          shortcut.type === 'interface' || actionTypes.has(shortcut.actionType),
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
  ): Record<string, unknown> {
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
    kits: Record<string, unknown>,
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
    const viewerHand = this.viewerHand(kits, viewerPlayerId);
    const started =
      this.stringValue(this.asRecord(system.match).status).toLowerCase() ===
      'started';
    const presentEvent = (rawEvent: unknown): Record<string, unknown> => {
      const event = this.asRecord(rawEvent);
      const data = this.asRecord(event.data);
      const type = this.stringValue(event.type);
      const supersededByGameMessage =
        (type === 'card.drawn' && semanticMessageKey === 'game.card.drawn') ||
        (type === 'card.received' &&
          semanticMessageKey === 'game.card.drawn') ||
        (type === 'card.played' && semanticMessageKey === 'game.card.played') ||
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
            presentation,
            viewerHand,
          );
      return message ? { ...event, data: { ...data, message } } : event;
    };
    const presented: Record<string, unknown> = {};
    for (const [key, rawEvent] of Object.entries(latestByType)) {
      presented[key] = presentEvent(rawEvent);
    }
    const recent = Array.isArray(events.recent)
      ? events.recent.map((event) => presentEvent(event))
      : [];
    return {
      ...system,
      events: { ...events, recent, latestByType: presented },
    };
  }

  private viewerHand(
    kits: Record<string, unknown>,
    viewerPlayerId: number | null,
  ): string[] {
    if (viewerPlayerId == null) return [];
    const cards = this.asRecord(kits.cards);
    const hands = this.asRecord(cards.hands);
    const result: string[] = [];
    for (const rawHand of Object.values(hands)) {
      const byPlayer = this.asRecord(this.asRecord(rawHand).byPlayer);
      const own = byPlayer[String(viewerPlayerId)];
      if (!Array.isArray(own)) continue;
      for (const card of own) {
        const label = this.cardLabel(card);
        if (label) result.push(label);
      }
    }
    return result;
  }

  private eventMessage(
    type: string,
    data: Record<string, unknown>,
    actorId: number | null,
    players: ReadonlyMap<number, string>,
    started: boolean,
    viewerPlayerId: number | null,
    receivedCardData: Record<string, unknown>,
    presentation: GamePresentationDescriptor,
    viewerHand: readonly string[],
  ): string {
    if (!started && (type === 'turn.started' || type === 'turn.ended'))
      return '';
    const explicit = this.stringValue(data.message);
    if (explicit) return explicit;

    const player = (value: unknown): string => {
      const id = this.numberValue(value);
      if (id == null) return '';
      return id === viewerPlayerId
        ? 'Vous'
        : (players.get(id) ?? `Joueur ${id}`);
    };
    const actor = player(actorId);
    const value = (key: string): string => this.scalarText(data[key]);

    if (type === 'game.message')
      return this.semanticMessage(
        data,
        player,
        players,
        receivedCardData,
        viewerHand,
      );

    if (type === 'turn.started') {
      const id = this.numberValue(data.playerId);
      const name = id == null ? '' : (players.get(id) ?? `Joueur ${id}`);
      return name ? `C'est au tour de ${name}.` : '';
    }
    if (type === 'turn.ended') return '';
    if (type === 'dice.rolled' && actor)
      return `${actor} lance les dés${value('total') ? ` : ${value('total')}` : ''}.`;
    if (type === 'card.drawn' && actor)
      return `${actor} ${actor === 'Vous' ? 'piochez' : 'pioche'} une carte.`;
    if (type === 'card.received') {
      const name = player(data.playerId);
      return name ? `${name} reçoit une carte.` : '';
    }
    if (type === 'card.played' && actor)
      return `${actor} joue ${this.scalarText(data.card) || 'une carte'}.`;
    if (type === 'score.changed' && data.announce !== false)
      return this.scoreMessage(data, player, presentation.score);
    if (type === 'player.eliminated') {
      const name = player(data.playerId);
      return name ? `${name} est éliminé.` : '';
    }
    if (type === 'player.skipped') {
      const name = player(data.playerId);
      return name ? `${name} passe son tour.` : '';
    }
    if (type === 'round.player-left') {
      const name = player(data.playerId);
      return name
        ? `${name} ${name === 'Vous' ? 'sortez' : 'sort'} de la manche.`
        : '';
    }
    if (type === 'match.started') return 'La partie démarre, bon jeu !';
    if (type === 'round.started' && value('number'))
      return `La manche ${value('number')} commence.`;
    if (type === 'round.ended') return 'La manche est terminée.';
    if (type === 'game.finished') return 'La partie est terminée.';
    return '';
  }

  private semanticMessage(
    data: Record<string, unknown>,
    player: (value: unknown) => string,
    players: ReadonlyMap<number, string>,
    receivedCardData: Record<string, unknown>,
    viewerHand: readonly string[],
  ): string {
    const messageKey = this.stringValue(data.key);
    const params = this.asRecord(data.params);
    const namedPlayer = player(params.playerId);
    const card =
      this.scalarText(params.cardLabel) || this.scalarText(params.cardId);
    if (messageKey === 'game.card.played' && namedPlayer)
      return `${namedPlayer} ${namedPlayer === 'Vous' ? 'jouez' : 'joue'} ${card || 'une carte'}.`;
    if (messageKey === 'game.card.drawn' && namedPlayer) {
      const drawnForPlayer = this.numberValue(params.playerId);
      const receivedByPlayer = this.numberValue(receivedCardData.playerId);
      const privateCard =
        namedPlayer === 'Vous' && drawnForPlayer === receivedByPlayer
          ? this.cardLabel(receivedCardData.card)
          : '';
      return `${namedPlayer} ${namedPlayer === 'Vous' ? 'piochez' : 'pioche'} ${privateCard || 'une carte'}.`;
    }
    if (messageKey === 'game.player.passed' && namedPlayer)
      return namedPlayer === 'Vous'
        ? 'Vous passez votre tour.'
        : `${namedPlayer} passe son tour.`;
    if (messageKey !== 'game.round.started') return '';
    const round = this.scalarText(params.round);
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
    if (viewerHand.length > 0)
      messages.push(`Vos cartes : ${viewerHand.join(', ')}.`);
    if (starter) messages.push(`C'est au tour de ${starter}.`);
    return messages.join('\n');
  }

  private scoreMessage(
    data: Record<string, unknown>,
    player: (value: unknown) => string,
    presentation?: ScorePresentationDescriptor,
  ): string {
    const name = player(data.playerId);
    const value = this.scalarText(data.value);
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

  private numberValue(value: unknown): number | null {
    const number = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(number) ? number : null;
  }

  private scalarText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return '';
  }

  private cardLabel(value: unknown): string {
    const scalar = this.scalarText(value);
    if (scalar) return scalar;
    const card = this.asRecord(value);
    return (
      this.scalarText(card.label) ||
      this.scalarText(card.name) ||
      this.scalarText(card.id) ||
      this.scalarText(card.value)
    );
  }
}
