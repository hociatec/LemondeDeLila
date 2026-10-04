import {
  presentationRelations,
  withoutDuplicateTurnIdentities,
  type PresentationRelations,
} from './game-ws-event-relations';
import type { GameRuntimeDescriptor } from '../../../../application/ports/game-runtime.port';
import { genericGameEventMessage } from './game-ws-generic-event-message';
import { gridPawnMessage } from './game-ws-grid-pawn-message';
import { cardMessageLabel, scalarMessageText } from './game-ws-message-values';
import { withoutRepeatedTurnAnnouncements } from './game-ws-turn-announcements';
import { withSoundSemantics } from './game-ws-sound-semantics';
import {
  decodeReceivedCardData,
  decodeScoreChangedData,
  decodeSemanticMessageData,
  decodeMessageSystem,
  decodeTurnStartedData,
  type MessageEventData,
  type ReceivedCardEventData,
  type ScoreChangedEventData,
  type SemanticMessageData,
  type SemanticMessageParams,
  type MessageSystemView,
  type MessageViewEvent,
  type TurnStartedEventData,
} from './game-ws-message-system-view';

type GamePresentationDescriptor = NonNullable<
  GameRuntimeDescriptor['presentation']
>;
type ScorePresentationDescriptor = NonNullable<
  GamePresentationDescriptor['score']
>;
export class GameWsStateMessagesPresenter {
  withServerMessages(
    rawSystem: unknown,
    viewerPlayerId: number | null,
    presentation: GamePresentationDescriptor,
  ): MessageSystemView {
    const system = decodeMessageSystem(rawSystem);
    const playerNames = this.playerNames(system);
    const events = system.events;
    const latestByType = events.latestByType;
    const receivedCardData = decodeReceivedCardData(
      latestByType['card.received']?.data,
    );
    const recentEvents = events.recent;
    const relations = presentationRelations(recentEvents, latestByType);
    const started = isActiveMatchStatus(system.match.status);
    const presentEvent = (rawEvent: MessageViewEvent): MessageViewEvent =>
      this.presentEvent({
        rawEvent,
        relations,
        playerNames,
        started,
        viewerPlayerId,
        receivedCardData,
        presentation,
      });
    const presented = this.presentLatestByType(latestByType, presentEvent);
    const recent = withoutRepeatedTurnAnnouncements(
      withoutDuplicateTurnIdentities(
        recentEvents.map((event) => presentEvent(event)),
      ),
    );
    const sounded = withSoundSemantics(recent, presented, viewerPlayerId);
    return {
      ...system,
      events: {
        ...events,
        recent: sounded.recent,
        latestByType: sounded.latestByType,
      },
    };
  }

  private playerNames(system: MessageSystemView): Map<number, string> {
    const players = system.players.all;
    const names = new Map<number, string>();
    for (const player of players.slice(0, 128)) {
      const username = player.username.trim();
      if (username) names.set(player.id, username.slice(0, 255));
    }
    return names;
  }

  private presentLatestByType(
    latestByType: Readonly<Record<string, MessageViewEvent>>,
    presentEvent: (rawEvent: MessageViewEvent) => MessageViewEvent,
  ): Record<string, MessageViewEvent> {
    const presented: Record<string, MessageViewEvent> = {};
    for (const [key, rawEvent] of Object.entries(latestByType).slice(0, 512)) {
      presented[key] = presentEvent(rawEvent);
    }
    return presented;
  }

  private presentEvent(input: {
    rawEvent: MessageViewEvent;
    relations: PresentationRelations;
    playerNames: ReadonlyMap<number, string>;
    started: boolean;
    viewerPlayerId: number | null;
    receivedCardData: ReceivedCardEventData;
    presentation: GamePresentationDescriptor;
  }): MessageViewEvent {
    const event = input.rawEvent;
    const data = event.data;
    const type = event.type;
    const eventId = event.id;
    if (input.relations.suppressedEventIds.has(eventId)) return event;
    const pairedTurn = input.relations.turnByMessageId.get(eventId);
    const message = this.eventMessage(
      type,
      data,
      event.actorId,
      input.playerNames,
      input.started,
      input.viewerPlayerId,
      input.receivedCardData,
      decodeTurnStartedData(pairedTurn?.data),
      input.presentation,
    );
    return message ? { ...event, data: { ...data, message } } : event;
  }

  private eventMessage(
    type: string,
    data: MessageEventData,
    actorId: number | null,
    players: ReadonlyMap<number, string>,
    started: boolean,
    viewerPlayerId: number | null,
    receivedCardData: ReceivedCardEventData,
    nextTurnData: TurnStartedEventData,
    presentation: GamePresentationDescriptor,
  ): string {
    if (!started && (type === 'turn.started' || type === 'turn.ended'))
      return '';
    if (data.announce === false) return '';
    const narration = data.narration;
    const narrationByPlayerId = narration?.byPlayerId ?? {};
    const ownedNarration =
      (viewerPlayerId == null
        ? ''
        : narrationByPlayerId[String(viewerPlayerId)]?.trim()) ||
      narration?.default?.trim();
    if (ownedNarration) return ownedNarration;
    const explicit = data.message?.trim();
    if (explicit) return explicit;

    const player = (value: number | null | undefined): string =>
      this.playerLabel(value, players, viewerPlayerId);
    if (type === 'game.message') {
      return this.semanticMessage(
        decodeSemanticMessageData(data),
        player,
        players,
        viewerPlayerId,
        receivedCardData,
        nextTurnData,
      );
    }
    if (type === 'score.changed')
      return this.scoreMessage(
        decodeScoreChangedData(data),
        player,
        presentation.score,
      );
    return genericGameEventMessage({
      type,
      data,
      actorId,
      players,
      viewerPlayerId,
    });
  }

  private playerLabel(
    value: number | null | undefined,
    players: ReadonlyMap<number, string>,
    viewerPlayerId: number | null,
  ): string {
    const id = value;
    if (id == null) return '';
    return id === viewerPlayerId ? 'Vous' : (players.get(id) ?? `Joueur ${id}`);
  }

  private semanticMessage(
    data: SemanticMessageData,
    player: (value: number | undefined) => string,
    players: ReadonlyMap<number, string>,
    viewerPlayerId: number | null,
    receivedCardData: ReceivedCardEventData,
    nextTurnData: TurnStartedEventData,
  ): string {
    const messageKey = data.key;
    const params = data.params;
    const namedPlayer = player(params.playerId);
    const gridMessage = gridPawnMessage(messageKey, params, namedPlayer);
    if (gridMessage) return gridMessage;
    // Question and answer choices are rendered in the gameplay workflow.
    // Keep per-player activity out of the shared history, but announce the
    // revealed correct answer there once the quiz resolves.
    if (
      messageKey === 'game.quiz.started' ||
      messageKey === 'game.quiz.answer-recorded'
    )
      return '';
    if (messageKey === 'game.quiz.resolved')
      return this.quizResolvedMessage(params, viewerPlayerId);
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
    if (messageKey === 'game.dice.rolled' && namedPlayer) {
      const total = params.total;
      if (total == null) return '';
      const value = frenchNumber(total);
      return namedPlayer === 'Vous'
        ? `Vous lancez le dé et faites un ${value}.`
        : `${namedPlayer} lance le dé et fait un ${value}.`;
    }
    if (messageKey === 'game.pawn.bonus-advance' && namedPlayer)
      return this.pawnBonusMessage(namedPlayer, params);
    if (messageKey === 'game.positions.swapped') {
      const actor = player(params.actorId);
      const target = player(params.targetId);
      if (!actor || !target) return '';
      if (actor === 'Vous') return `Vous échangez votre place avec ${target}.`;
      if (target === 'Vous') return `${actor} échange sa place avec vous.`;
      return `${actor} échange sa place avec ${target}.`;
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
    return this.roundStartedMessage(params, players);
  }

  private quizResolvedMessage(
    params: SemanticMessageParams,
    viewerPlayerId: number | null,
  ): string {
    if (viewerPlayerId != null) {
      const ownResult = params.results.find(
        (result) => result.playerId === viewerPlayerId,
      );
      if (ownResult?.outcome === 'correct') return '';
    }
    const correctAnswer = params.correctAnswer;
    return correctAnswer ? `La bonne réponse était « ${correctAnswer} ».` : '';
  }

  private pawnBonusMessage(
    namedPlayer: string,
    params: SemanticMessageParams,
  ): string {
    const spaces = params.spaces ?? 0;
    const backward = spaces < 0;
    const amount = `${Math.abs(spaces)} case${Math.abs(spaces) === 1 ? '' : 's'}`;
    const verb = backward
      ? namedPlayer === 'Vous'
        ? 'vous reculez'
        : `${namedPlayer} recule`
      : namedPlayer === 'Vous'
        ? 'vous avancez'
        : `${namedPlayer} avance`;
    return `Effet : ${verb} de ${amount}.`;
  }

  private drawnCardMessage(input: {
    namedPlayer: string;
    params: SemanticMessageParams;
    card: string;
    receivedCardData: ReceivedCardEventData;
    nextTurnData: TurnStartedEventData;
    players: ReadonlyMap<number, string>;
  }): string {
    const card = this.displayedCard(input);
    const effectDescription = scalarMessageText(input.params.effectDescription);
    const effectAnnouncement =
      effectDescription && !card.includes(effectDescription)
        ? ` Effet : ${effectDescription.replace(/[.!?]+$/u, '')}.`
        : '';
    return this.withNextTurn(
      `${input.namedPlayer} ${input.namedPlayer === 'Vous' ? 'piochez' : 'pioche'} ${card}.${effectAnnouncement}`,
      input.nextTurnData,
      input.players,
    );
  }

  private displayedCard(input: {
    namedPlayer: string;
    params: SemanticMessageParams;
    card: string;
    receivedCardData: ReceivedCardEventData;
  }): string {
    const drawnForPlayer = input.params.playerId;
    const receivedByPlayer = input.receivedCardData.playerId;
    const privateCard =
      input.namedPlayer === 'Vous' && drawnForPlayer === receivedByPlayer
        ? cardMessageLabel(input.receivedCardData.card)
        : '';
    if (input.params.revealed === true && input.card)
      return `« ${input.card} »`;
    return privateCard || 'une carte';
  }

  private roundStartedMessage(
    params: SemanticMessageParams,
    players: ReadonlyMap<number, string>,
  ): string {
    const round = scalarMessageText(params.round);
    const starterId = params.starterPlayerId;
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
    if (starter) messages.push(turnAnnouncement(starter));
    return messages.join('\n');
  }

  private withNextTurn(
    message: string,
    nextTurnData: TurnStartedEventData,
    players: ReadonlyMap<number, string>,
  ): string {
    const playerId = nextTurnData.playerId;
    if (playerId == null) return message;
    const name = players.get(playerId) ?? `Joueur ${playerId}`;
    return `${message}\n${turnAnnouncement(name)}`;
  }

  private scoreMessage(
    data: ScoreChangedEventData,
    player: (value: number | undefined) => string,
    presentation?: ScorePresentationDescriptor,
  ): string {
    const name = player(data.playerId);
    const value = scalarMessageText(data.value);
    const delta = data.delta;
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
      ? `${name} ${name === 'Vous' ? 'avez' : 'a'} maintenant ${value} ${scoreUnit(presentation, typeof data.value === 'number' ? data.value : 0)}.`
      : '';
  }
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

function frenchNumber(value: number): string {
  const values = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
  return values[value] ?? String(value);
}

function turnAnnouncement(name: string): string {
  const preposition = /^[aeiouyhàâäéèêëîïôöùûü]/iu.test(name) ? 'd’' : 'de ';
  return `C'est au tour ${preposition}${name}.`;
}

function isActiveMatchStatus(value: unknown): boolean {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return status === 'started' || status === 'playing';
}
