import type { GameRuntimeDescriptor } from '../../../../application/contracts/game-runtime.interface';
import { genericGameEventMessage } from './game-ws-generic-event-message';
import { cardMessageLabel, scalarMessageText } from './game-ws-message-values';

type GamePresentationDescriptor = NonNullable<
  GameRuntimeDescriptor['presentation']
>;
type ScorePresentationDescriptor = NonNullable<
  GamePresentationDescriptor['score']
>;

export class GameWsStateMessagesPresenter {
  withServerMessages(
    system: Record<string, unknown>,
    viewerPlayerId: number | null,
    presentation: GamePresentationDescriptor,
  ): Record<string, unknown> {
    const playerNames = this.playerNames(system);
    const events = this.asRecord(system.events);
    const latestByType = this.asRecord(events.latestByType);
    const semanticMessageKey = this.semanticMessageKey(latestByType);
    const receivedCardData = this.asRecord(
      this.asRecord(latestByType['card.received']).data,
    );
    const recentEvents = Array.isArray(events.recent) ? events.recent : [];
    const pairedTurn = this.pairedTurnAfterSemanticMessage(
      recentEvents,
      this.asRecord(latestByType['game.message']),
      semanticMessageKey,
    );
    const started = isActiveMatchStatus(this.asRecord(system.match).status);
    const presentEvent = (rawEvent: unknown): Record<string, unknown> =>
      this.presentEvent({
        rawEvent,
        semanticMessageKey,
        pairedTurn,
        playerNames,
        started,
        viewerPlayerId,
        receivedCardData,
        presentation,
      });
    const presented = this.presentLatestByType(latestByType, presentEvent);
    const recent = this.withoutRepeatedTurnAnnouncements(
      recentEvents.map((event) => presentEvent(event)),
    );
    return {
      ...system,
      events: { ...events, recent, latestByType: presented },
    };
  }

  private playerNames(system: Record<string, unknown>): Map<number, string> {
    const players = this.asRecord(system.players).all;
    const names = new Map<number, string>();
    for (const value of Array.isArray(players) ? players : []) {
      const player = this.asRecord(value);
      const id = this.numberValue(player.id);
      const username = this.stringValue(player.username);
      if (id != null && username) names.set(id, username);
    }
    return names;
  }

  private semanticMessageKey(latestByType: Record<string, unknown>): string {
    return this.stringValue(
      this.asRecord(this.asRecord(latestByType['game.message']).data).key,
    );
  }

  private presentLatestByType(
    latestByType: Record<string, unknown>,
    presentEvent: (rawEvent: unknown) => Record<string, unknown>,
  ): Record<string, unknown> {
    const presented: Record<string, unknown> = {};
    for (const [key, rawEvent] of Object.entries(latestByType)) {
      presented[key] = presentEvent(rawEvent);
    }
    return presented;
  }

  private presentEvent(input: {
    rawEvent: unknown;
    semanticMessageKey: string;
    pairedTurn: { eventId: string; data: Record<string, unknown> };
    playerNames: ReadonlyMap<number, string>;
    started: boolean;
    viewerPlayerId: number | null;
    receivedCardData: Record<string, unknown>;
    presentation: GamePresentationDescriptor;
  }): Record<string, unknown> {
    const event = this.asRecord(input.rawEvent);
    const data = this.asRecord(event.data);
    const type = this.stringValue(event.type);
    if (this.isSupersededByGameMessage(type, event, input)) return event;
    const message = this.eventMessage(
      type,
      data,
      this.numberValue(event.actorId),
      input.playerNames,
      input.started,
      input.viewerPlayerId,
      input.receivedCardData,
      input.pairedTurn.data,
      input.presentation,
    );
    return message ? { ...event, data: { ...data, message } } : event;
  }

  private isSupersededByGameMessage(
    type: string,
    event: Record<string, unknown>,
    input: { semanticMessageKey: string; pairedTurn: { eventId: string } },
  ): boolean {
    return (
      (type === 'card.drawn' &&
        input.semanticMessageKey === 'game.card.drawn') ||
      (type === 'card.received' &&
        input.semanticMessageKey === 'game.card.drawn') ||
      (type === 'card.played' &&
        input.semanticMessageKey === 'game.card.played') ||
      (type === 'turn.started' &&
        this.stringValue(event.id) === input.pairedTurn.eventId) ||
      (input.semanticMessageKey === 'game.round.started' &&
        isInitialRoundEvent(type))
    );
  }

  private withoutRepeatedTurnAnnouncements(
    events: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    let previousLastLine = '';
    return events.map((event) => {
      const data = this.asRecord(event.data);
      const message = this.stringValue(data.message);
      if (!message) return event;
      const lines = message
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const isRepeatedTurn =
        lines.length === 1 &&
        lines[0].startsWith("C'est au tour de ") &&
        lines[0] === previousLastLine;
      if (isRepeatedTurn) {
        const remainingData = { ...data };
        delete remainingData.message;
        return { ...event, data: remainingData };
      }
      previousLastLine = lines.at(-1) ?? previousLastLine;
      return event;
    });
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

    const player = (value: unknown): string =>
      this.playerLabel(value, players, viewerPlayerId);
    if (type === 'game.message') {
      return this.semanticMessage(
        data,
        player,
        players,
        receivedCardData,
        nextTurnData,
      );
    }
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

  private playerLabel(
    value: unknown,
    players: ReadonlyMap<number, string>,
    viewerPlayerId: number | null,
  ): string {
    const id = this.numberValue(value);
    if (id == null) return '';
    return id === viewerPlayerId ? 'Vous' : (players.get(id) ?? `Joueur ${id}`);
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
      return this.drawnCardMessage({
        namedPlayer,
        params,
        card,
        receivedCardData,
        nextTurnData,
        players,
      });
    }
    if (messageKey === 'game.card.draw-required' && namedPlayer)
      return namedPlayer === 'Vous'
        ? 'Vous devez piocher une carte. Appuyez sur Espace.'
        : `${namedPlayer} doit piocher une carte.`;
    if (messageKey === 'game.pawn.selection-requested' && namedPlayer)
      return namedPlayer === 'Vous'
        ? 'Vous devez choisir votre pion.'
        : `${namedPlayer} doit choisir son pion.`;
    if (messageKey === 'game.pawn.bonus-advance' && namedPlayer)
      return this.pawnBonusMessage(namedPlayer, params);
    if (messageKey === 'game.player.passed' && namedPlayer)
      return this.withNextTurn(
        namedPlayer === 'Vous'
          ? 'Vous passez votre tour.'
          : `${namedPlayer} passe son tour.`,
        nextTurnData,
        players,
      );
    if (messageKey !== 'game.round.started') return '';
    return this.roundStartedMessage(params, players);
  }

  private pawnBonusMessage(
    namedPlayer: string,
    params: Record<string, unknown>,
  ): string {
    const spaces = this.numberValue(params.spaces) ?? 0;
    const distance = `${spaces} case${Math.abs(spaces) === 1 ? '' : 's'}`;
    const verb =
      namedPlayer === 'Vous' ? 'vous avancez' : `${namedPlayer} avance`;
    return `Bonus : ${verb} de ${distance}.`;
  }

  private drawnCardMessage(input: {
    namedPlayer: string;
    params: Record<string, unknown>;
    card: string;
    receivedCardData: Record<string, unknown>;
    nextTurnData: Record<string, unknown>;
    players: ReadonlyMap<number, string>;
  }): string {
    const card = this.displayedCard(input);
    const effectDescription = scalarMessageText(input.params.effectDescription);
    const effectAnnouncement = effectDescription
      ? ` Effet : ${effectDescription.replace(/[.!?]+$/u, '')}.`
      : '';
    const automatic =
      input.params.automatic === true
        ? ' Son effet est appliqué automatiquement.'
        : '';
    return this.withNextTurn(
      `${input.namedPlayer} ${input.namedPlayer === 'Vous' ? 'piochez' : 'pioche'} ${card}.${effectAnnouncement}${automatic}`,
      input.nextTurnData,
      input.players,
    );
  }

  private displayedCard(input: {
    namedPlayer: string;
    params: Record<string, unknown>;
    card: string;
    receivedCardData: Record<string, unknown>;
  }): string {
    const drawnForPlayer = this.numberValue(input.params.playerId);
    const receivedByPlayer = this.numberValue(input.receivedCardData.playerId);
    const privateCard =
      input.namedPlayer === 'Vous' && drawnForPlayer === receivedByPlayer
        ? cardMessageLabel(input.receivedCardData.card)
        : '';
    if (input.params.revealed === true && input.card)
      return `« ${input.card} »`;
    return privateCard || 'une carte';
  }

  private roundStartedMessage(
    params: Record<string, unknown>,
    players: ReadonlyMap<number, string>,
  ): string {
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
    )
      return { eventId: '', data: {} };
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
        return `${name} ${name === 'Vous' ? 'recevez' : 'reçoit'} ${delta} ${scoreUnit(presentation, delta)} et ${name === 'Vous' ? 'en avez' : 'en a'} maintenant ${value}.`;
      if (delta < 0)
        return `${name} ${name === 'Vous' ? 'rendez' : 'rend'} ${Math.abs(delta)} ${scoreUnit(presentation, Math.abs(delta))} et ${name === 'Vous' ? 'en avez' : 'en a'} maintenant ${value}.`;
      return '';
    }
    return name && value
      ? `${name} ${name === 'Vous' ? 'avez' : 'a'} maintenant ${value} ${scoreUnit(presentation, this.numberValue(data.value) ?? 0)}.`
      : '';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private numberValue(value: unknown): number | null {
    const number = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(number) ? number : null;
  }
}

function isInitialRoundEvent(type: string): boolean {
  return (
    type === 'match.started' ||
    type === 'round.started' ||
    type === 'turn.started' ||
    type === 'card.drawn' ||
    type === 'card.received' ||
    type === 'card.discarded'
  );
}

function scoreUnit(
  presentation: ScorePresentationDescriptor | undefined,
  value: number,
): string {
  const unit = presentation?.unit ?? {
    singular: 'point',
    plural: 'points',
  };
  return Math.abs(value) === 1 ? unit.singular : unit.plural;
}

function isActiveMatchStatus(value: unknown): boolean {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return status === 'started' || status === 'playing';
}
