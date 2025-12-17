import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto, GameStateWithActions } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../../engine/services/game-registry.service';
import { DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { ActionResolverService } from '../../../../../modules/action-resolver/services/action-resolver.service';
import { ActionLogService, ActionLogEntry } from '../../../../../modules/actionlog/services/action-log.service';
import { PhaseEngineService, PhaseDefinition } from '../../../../../modules/state/services/phase-engine.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';
import { DAME_NATURE_PHASES } from '../definitions/rules.definition';
import { DAME_NATURE_VICTORY } from '../definitions/victory.definition';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { DameNatureSetupService, FamilyCard } from './dame-nature-setup.service';
import { DameNatureActionService } from './dame-nature-action.service';
import { DameNatureBotService } from './dame-nature-bot.service';
import { DameNatureBooksService } from './dame-nature-books.service';

export type DameNatureMetadata = {
  decks: DeckPoolState<FamilyCard>;
  familyGoal: number;
  pollution: number;
  maxPollution: number;
  catalog: { families: { id: string; name: string }[] };
  actionLog: ActionLogEntry[];
  phaseId?: string;
  botProfile?: import('../../../../../modules/bot/services/bot-strategy.service').BotProfile;
  victoryId?: string | null;
  winnerId?: string | number | null;
  pendingAsk?: {
    fromId: number;
    targetId: number;
    familyId: string;
    memberId?: string | null;
    offerMemberId?: string | null;
  } | null;
  pendingQuiz?: {
    playerId: number;
    card: FamilyCard;
  } | null;
};

type PlayerExt = PlayerStateEntity & {
  hand: FamilyCard[];
  handCount: number;
  books: string[];
};

@Injectable()
export class DameNatureService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = 'Dame Nature';
  readonly description = 'Jeu de familles coopératif avec pollution et quiz.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;
  private readonly phaseOrder: PhaseDefinition<DameNatureMetadata>[] = DAME_NATURE_PHASES;

  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnService,
    private readonly resolver: ActionResolverService,
    private readonly actionLog: ActionLogService,
    private readonly phases: PhaseEngineService<DameNatureMetadata>,
    private readonly victory: VictoryService,
    private readonly registry: GameRegistryService,
    private readonly setup: DameNatureSetupService,
    private readonly actions: DameNatureActionService,
    private readonly bots: DameNatureBotService,
    private readonly books: DameNatureBooksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata = this.setup.buildMetadata();
    const players = this.setup.initializePlayers(baseState, metadata) as PlayerExt[];
    const initial: GameStateEntity = {
      ...baseState,
      players,
      status: baseState.status ?? 'open',
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1 as const,
      },
      turnIndex: players.length ? 0 : -1,
      metadata,
    };
    dameNatureLog('init', {
      status: initial.status,
      turnIndex: initial.turnIndex,
      players: players.map((p) => ({ id: p.id, bot: p.isBot })),
    });
    if (initial.turn?.currentPlayerId != null) {
      const current = players.find((p) => p.id === initial.turn?.currentPlayerId);
      dameNatureLog('turn.start', { turnIndex: initial.turnIndex, playerId: current?.id ?? null, username: current?.username ?? null });
    }
    return initial;
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = this.ensureMetadata(state);
    next = this.ensurePlayersState(next);
    next = this.resolver.apply(next, actions, (s, a) => this.dispatchAction(s, a));
    next = this.applyVictory(next);
    // Si le tour reste sur un bot, marquer l'état comme botThinking pour déclencher le timer côté moteur
    if (next.turn?.currentPlayerId != null && this.isBotId(next.turn.currentPlayerId, next)) {
      next = { ...next, botThinking: true };
      const currentId = next.turn?.currentPlayerId ?? null;
      playingLog('damenature.bot.thinking', { currentPlayerId: currentId, turnIndex: next.turnIndex });
    } else {
      next = { ...next, botThinking: false };
    }
    return next;
  }

  private dispatchAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (!action?.type) return state;

    let next = this.ensureStarted(state);
    // Verrou : seule l'action du joueur courant est acceptée, sauf réponse à une demande en attente.
    const pendingAsk = (next.metadata as DameNatureMetadata)?.pendingAsk;
    let actorId = this.extractActorId(action);
    // Sécurité : si une réponse de demande arrive sans actorId, on l'assigne à la cible attendue.
    if (actorId == null && action.type.toLowerCase().startsWith('answer_ask_card') && pendingAsk?.targetId != null) {
      actorId = pendingAsk.targetId;
    }
    if (next.turn?.currentPlayerId != null) {
      const currentId = next.turn.currentPlayerId;
      const pending = pendingAsk;
      const pendingQuiz = (next.metadata as DameNatureMetadata)?.pendingQuiz;
      const typeLower = action.type.toLowerCase();
      const isAnswer =
        typeLower === 'answer_ask_card' ||
        typeLower === 'answer_ask_card_accept' ||
        typeLower === 'answer_ask_card_refuse';
      const isPendingTarget = pending && actorId != null && actorId === pending.targetId;
      const isQuizAnswer = action.type.toLowerCase().startsWith('answer_quiz');
      const isQuizTarget = pendingQuiz && actorId != null && actorId === pendingQuiz.playerId;
      if (pending && !(isAnswer && isPendingTarget)) {
        dameNatureLog('block.pending_ask', { actorId, currentId, pending });
        return next; // rien d'autre tant que la demande n'est pas résolue
      }
      if (pendingQuiz && (!isQuizAnswer || !isQuizTarget)) {
        dameNatureLog('block.pending_quiz', { actorId, currentId, pendingQuiz });
        return next; // bloqué tant que le joueur concerné n'a pas répondu
      }
      if (actorId != null && actorId !== currentId && !(isAnswer && isPendingTarget)) {
        dameNatureLog('block.not_current_player', { actorId, currentId, action: action.type });
        return next;
      }
      const currentIsBot = this.isBotId(currentId, next);
      if (currentIsBot && actorId == null) {
        // On ignore toute action humaine quand c'est le tour du bot.
        dameNatureLog('block.bot_turn', { currentId, action: action.type });
        return next;
      }
    }

    switch (action.type.toLowerCase()) {
      case 'draw':
        dameNatureLog('action.draw', { actorId, current: next.turn?.currentPlayerId ?? null });
        next = this.handleDraw(next, actorId);
        break;
      case 'discard_card':
        next = this.handleDiscard(next, action, actorId);
        break;
      case 'ask_card':
        dameNatureLog('action.ask_card', { actorId, current: next.turn?.currentPlayerId ?? null });
        next = this.handleAskCard(next, action, actorId);
        break;
      case 'answer_ask_card':
        dameNatureLog('action.answer_ask', { actorId, pending: (next.metadata as DameNatureMetadata)?.pendingAsk ?? null });
        next = this.handleAnswerAskCard(next, action, actorId);
        break;
      case 'answer_ask_card_accept': {
        const payload = { ...(action.payload ?? {}), accept: true };
        next = this.handleAnswerAskCard(next, { ...action, type: 'answer_ask_card', payload }, actorId);
        break;
      }
      case 'answer_ask_card_refuse': {
        const payload = { ...(action.payload ?? {}), accept: false };
        dameNatureLog('action.answer_ask', { actorId, pending: (next.metadata as DameNatureMetadata)?.pendingAsk ?? null });
        next = this.handleAnswerAskCard(next, { ...action, type: 'answer_ask_card', payload }, actorId);
        break;
      }
      case 'answer_quiz':
      case 'answer_quiz_correct':
      case 'answer_quiz_wrong':
        dameNatureLog('action.answer_quiz', { actorId, pending: (next.metadata as DameNatureMetadata)?.pendingQuiz ?? null });
        next = this.handleQuizAnswer(next, action, actorId);
        break;
      default:
        next = this.core.appendLog(next, `Action non gérée: ${action.type}`);
    }
    return this.advancePhase(next);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const meta = state.metadata as DameNatureMetadata;
    const familyDeck = meta.decks?.family ?? { deck: [], discards: [] };
    const deckAvailable = (familyDeck.deck?.length ?? 0) + (familyDeck.discards?.length ?? 0) > 0;
    const players = this.ensurePlayers(state);
    const others = players.filter((p) => p.id !== playerId);
    const families = this.setup.families();
    if (meta.pendingAsk) {
      if (meta.pendingAsk.targetId === playerId) {
        return [
          { type: 'answer_ask_card_accept', payload: { accept: true, playerId } },
          { type: 'answer_ask_card_refuse', payload: { accept: false, playerId } },
        ];
      }
      return [];
    }
    if (meta.pendingQuiz) {
      if (meta.pendingQuiz.playerId === playerId) {
        const choices = meta.pendingQuiz.card?.choices ?? ['Bonne réponse', 'Mauvaise réponse'];
        return choices.map((choice) => ({
          type: 'answer_quiz',
          payload: { playerId, answer: choice },
        }));
      }
      return [];
    }

    const actions: GameSingleActionDto[] = [];
    const me = players.find((p) => p.id === playerId);
    const canDraw = deckAvailable && (me?.hand?.length ?? 0) < 4;
    if (canDraw) {
      actions.push({ type: 'draw' });
    }
    // Discard actions (obligatoire si main > 4 ou pour gérer l'espace pioche)
    if ((me?.hand?.length ?? 0) > 0) {
      (me?.hand ?? []).forEach((card) => {
        actions.push({ type: 'discard_card', payload: { memberId: card.memberId, familyId: card.familyId } });
      });
    }
    // Pas de payload par défaut : le client sélectionne la cible/la carte avant d'envoyer.
    actions.push({ type: 'ask_card', payload: { playerId } });
    return actions;
  }

  private handleDraw(state: GameStateEntity, actorId: number | null): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current = currentId != null ? players.find((p) => p.id === currentId) : null;
    if (!current) {
      // Corriger un tour invalide en avançant
      const fixed = this.advanceTurn(state);
      return fixed;
    }
    const normalizedState: GameStateEntity = { ...state, players };
    const result = this.actions.handleDraw(normalizedState, current, meta);
    let next = result.state;
    if (!result.skipAdvance) {
      next = this.advanceTurn(next);
    }
    return this.appendAction(next, { actorId: actorId ?? current.id, type: 'draw', payload: { cardId: result.card?.memberId ?? null } });
  }

  private handleDiscard(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity {
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current = currentId != null ? players.find((p) => p.id === currentId) : null;
    const memberId = action.payload?.memberId;
    if (!current || !memberId) return state;
    const card = current.hand.find((c) => c.memberId === String(memberId));
    if (!card) return state;
    current.hand = current.hand.filter((c) => c !== card);
    current.handCount = current.hand.length;
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const metadata = this.setup.discardCard(meta, card);
    let next: GameStateEntity = { ...state, players, metadata };
    next = this.core.appendLog(next, `${current.username} défausse ${card.memberName} (${card.familyName}).`);
    return this.advanceTurn(next);
  }

  private handleAskCard(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity {
    const familyId = action.payload?.familyId;
    const memberId = action.payload?.memberId;
    const targetId = action.payload?.target;
    const offerMemberId = action.payload?.offerMemberId ?? action.payload?.give ?? null;
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current = currentId != null ? players.find((p) => p.id === currentId) : null;
    const target = typeof targetId === 'number' ? players.find((p) => p.id === targetId) : null;
    if (!current || !target || !familyId) {
      // Demande invalide : log mais ne pas avancer le tour.
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (adversaire ou famille manquants).`),
        { actorId: actorId ?? currentId ?? null, type: 'ask_card_invalid', payload: action.payload },
      );
    }
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    if (meta.pendingAsk) {
      return state; // une demande est déjà en attente
    }
    // exiger un memberId précis
    if (!memberId) {
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (carte précise requise).`),
        { actorId: actorId ?? currentId ?? null, type: 'ask_card_invalid', payload: action.payload },
      );
    }
    // vérifier que le demandeur possède la carte pour formuler la demande
    const owns = current.hand.some((c) => c.memberId === String(memberId));
    if (!owns) {
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (vous devez posséder la carte à demander).`),
        { actorId: actorId ?? currentId ?? null, type: 'ask_card_invalid', payload: action.payload },
      );
    }
    // vérifier que l'éventuelle carte offerte est bien dans la main du demandeur
    const validOffer = offerMemberId
      ? current.hand.find((c) => c.memberId === String(offerMemberId)) ?? null
      : null;
    if (offerMemberId && !validOffer) {
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (la carte offerte n'est pas dans votre main).`),
        { actorId: actorId ?? currentId ?? null, type: 'ask_card_invalid', payload: action.payload },
      );
    }
    const pending = {
      fromId: current.id,
      targetId: target.id,
      familyId: typeof familyId === 'string' ? familyId : String(familyId ?? ''),
      memberId: String(memberId),
      offerMemberId: validOffer ? validOffer.memberId : null,
    };
    const hasCard = target.hand.some((c) => c.memberId === pending.memberId);
    // Si la cible est un bot : résolution immédiate (accept si carte dispo).
    if (target.isBot) {
      const accept = hasCard;
      const responseAction: GameSingleActionDto = {
        type: 'answer_ask_card',
        payload: { accept, playerId: target.id },
      };
      const withPending: GameStateEntity = { ...state, metadata: { ...meta, pendingAsk: pending }, players };
      const logged = this.appendAction(withPending, { actorId: actorId ?? currentId ?? null, type: 'ask_card', payload: pending });
      dameNatureLog('ask.auto', {
        fromId: current.id,
        targetId: target.id,
        family: pending.familyId,
        member: pending.memberId ?? null,
        accept,
      });
      return this.handleAnswerAskCard(logged, responseAction, target.id);
    }

    const nextMeta: DameNatureMetadata = { ...meta, pendingAsk: pending };
    // Le tour passe temporairement à la cible pour la réponse.
    let next: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      players,
      pending: { type: 'ask_card', playerId: current.id, targetPlayerId: target.id, blocking: true },
      turn: { currentPlayerId: target.id, direction: 1 as const },
    };
    next = this.appendAction(
      next,
      { actorId: actorId ?? currentId ?? null, type: 'ask_card', payload: pending },
    );
    next = this.core.appendLog(next, `${current.username} demande ${pending.familyId} à ${target.username}.`);
    dameNatureLog('ask.pending', {
      fromId: current.id,
      targetId: target.id,
      family: pending.familyId,
      member: pending.memberId ?? null,
      handTarget: target.handCount,
    });
    // Pas d'avance de tour tant que la cible n'a pas répondu.
    return next;
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = this.ensurePlayers(state);
    if (!players.length) return state;
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    if (meta.pendingAsk || meta.pendingQuiz) {
      // Tant qu'une demande ou un quiz est en attente, ne pas avancer.
      return state;
    }
    // Si la main du joueur courant dépasse 4, forcer la défausse uniquement.
    const currentPlayer = players.find((p) => p.id === state.turn?.currentPlayerId);
    if (currentPlayer && (currentPlayer.hand?.length ?? 0) > 4) {
      return state;
    }
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex = currentId != null ? players.findIndex((p) => p.id === currentId) : state.turnIndex;
    const next = this.turns.nextTurn(players as any, currentIndex >= 0 ? currentIndex : -1, {});
    const updated: GameStateEntity = {
      ...state,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: 1 as const,
      },
    };
    dameNatureLog('turn', { turnIndex: next.turnIndex, current: next.currentPlayerId });
    const newCurrent = players.find((p) => p.id === next.currentPlayerId);
    if (newCurrent) {
      dameNatureLog('turn.start', { turnIndex: next.turnIndex, playerId: newCurrent.id, username: newCurrent.username, hand: newCurrent.handCount, books: newCurrent.books.length });
    }
    const advanced = this.advancePhase(updated);
    return this.applyVictory(advanced);
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const base = this.setup.buildMetadata();
    const meta = (state.metadata as DameNatureMetadata | undefined) ?? base;
    return {
      ...state,
      metadata: {
        ...base,
        ...meta,
        actionLog: meta.actionLog ?? [],
        catalog: meta.catalog ?? base.catalog,
        decks: meta.decks ?? base.decks,
        phaseId: meta.phaseId ?? 'turn',
        botProfile: meta.botProfile ?? 'greedy',
        victoryId: meta.victoryId ?? null,
        winnerId: meta.winnerId ?? null,
        pendingQuiz: meta.pendingQuiz ?? null,
      },
    };
  }

  /**
   * Garantit que les joueurs incluent les champs requis du moteur et nos extensions Dame Nature.
   */
  private ensurePlayersState(state: GameStateEntity): GameStateEntity {
    const players = this.ensurePlayers(state);
    return { ...state, players };
  }

  private ensurePlayers(state: GameStateEntity): PlayerExt[] {
    return this.setup.ensurePlayers(state) as PlayerExt[];
  }

  private isStarted(state: GameStateEntity): boolean {
    return state.status?.toLowerCase() === 'started';
  }

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    if (this.isStarted(state)) return state;
    if ((state.status || '').toLowerCase() !== 'starting') return state;
    const players = this.ensurePlayers(state);
    if (players.length < this.minPlayers) return { ...state, players };
    const next: GameStateEntity = {
      ...state,
      players,
      status: 'started',
      turnIndex: players.length ? 0 : -1,
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1 as const,
      },
    };
    dameNatureLog('start', { turnIndex: next.turnIndex, current: next.turn?.currentPlayerId ?? null });
    return this.advancePhase(next);
  }

  private extractActorId(action: GameSingleActionDto): number | null {
    const candidate = (action as any).playerId ?? action.payload?.playerId ?? action.payload?.actorId;
    return typeof candidate === 'number' ? candidate : null;
  }

  private handleAnswerAskCard(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const pending = meta.pendingAsk;
    if (!pending) return state;
    if (actorId == null || actorId !== pending.targetId) {
      return state; // seul le joueur ciblé peut répondre
    }
    const accept = !!action.payload?.accept;
    const players = this.ensurePlayers(state);
    const asker = players.find((p) => p.id === pending.fromId);
    const target = players.find((p) => p.id === pending.targetId);
    if (!asker || !target) {
      const cleared: DameNatureMetadata = { ...meta, pendingAsk: null };
      return { ...state, metadata: cleared, players };
    }
    let next: GameStateEntity = { ...state, players };
    if (!accept) {
      const label = pending.memberId ? pending.memberId : pending.familyId;
      next = this.core.appendLog(next, `${target.username} refuse de donner ${label} à ${asker.username}.`);
      const cleared: DameNatureMetadata = { ...meta, pendingAsk: null };
      const requesterIndex = players.findIndex((p) => p.id === asker.id);
      const restored: GameStateEntity = {
        ...next,
        metadata: cleared,
        pending: null,
        turn: { currentPlayerId: asker.id, direction: 1 as const },
        turnIndex: requesterIndex >= 0 ? requesterIndex : next.turnIndex,
      };
      dameNatureLog('ask.refuse', { targetId: target.id, fromId: asker.id, family: pending.familyId, member: pending.memberId ?? null });
      return this.advanceTurn(restored);
    }
    const match = target.hand.find((c) =>
      pending.memberId ? c.memberId === pending.memberId : c.familyId === pending.familyId,
    );
    if (match) {
      target.hand = target.hand.filter((c) => c !== match);
      target.handCount = target.hand.length;
      asker.hand.push(match);
      asker.handCount = asker.hand.length;
      // Transfert de la carte offerte (si fournie et encore en main).
      if (pending.offerMemberId) {
        const offer = asker.hand.find((c) => c.memberId === pending.offerMemberId);
        if (offer) {
          asker.hand = asker.hand.filter((c) => c !== offer);
          asker.handCount = asker.hand.length;
          target.hand.push(offer);
          target.handCount = target.hand.length;
          next = this.core.appendLog(
            next,
            `${asker.username} donne ${offer.memberName} (${offer.familyName}) à ${target.username} en échange.`,
          );
        }
      }
      next = this.core.appendLog(
        next,
        `${target.username} donne ${match.memberName} (${match.familyName}) à ${asker.username}.`,
      );
      const booked = this.books.checkAndBook(next, asker);
      next = booked.state;
      if (booked.booked.length) {
        next = this.core.appendLog(
          this.appendAction(next, { actorId: asker.id, type: 'book', payload: { families: booked.booked } }),
          `${asker.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
        );
      }
    } else {
      next = this.core.appendLog(
        next,
        `${target.username} n'a pas ${pending.familyId} à donner.`,
      );
    }
    const cleared: DameNatureMetadata = { ...meta, pendingAsk: null };
    const requesterIndex = players.findIndex((p) => p.id === asker.id);
    const restored: GameStateEntity = {
      ...next,
      metadata: cleared,
      pending: null,
      turn: { currentPlayerId: asker.id, direction: 1 as const },
      turnIndex: requesterIndex >= 0 ? requesterIndex : next.turnIndex,
    };
    return this.advanceTurn(restored);
  }

  private handleQuizAnswer(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const pending = meta.pendingQuiz;
    if (!pending) return state;
    if (actorId == null || actorId !== pending.playerId) {
      return state; // seul le joueur concerné peut répondre
    }
    const players = this.ensurePlayers(state);
    const target = players.find((p) => p.id === pending.playerId);
    const payloadAnswer = typeof action.payload?.answer === 'string' ? action.payload.answer : null;
    const answerIsCorrect = (candidate: string | null | undefined) =>
      (candidate ?? '').trim().toLowerCase() === (pending.card.answer ?? '').trim().toLowerCase();
    const correctFromType = action.type.toLowerCase().endsWith('correct');
    const correctFromPayload = typeof action.payload?.correct === 'boolean' ? action.payload.correct : null;
    const correct =
      correctFromPayload != null
        ? correctFromPayload
        : payloadAnswer != null
        ? answerIsCorrect(payloadAnswer)
        : correctFromType;
    const clearedMeta: DameNatureMetadata = { ...meta, pendingQuiz: null };
    let next: GameStateEntity = { ...state, metadata: clearedMeta, players: this.ensurePlayers(state), pending: null };
    if (correct) {
      next = this.actions.applyPollutionTick(next, 'Quiz réussi', -1);
      next = this.core.appendLog(
        next,
        `${target?.username ?? 'Un joueur'} réussit le quiz (${pending.card.memberName ?? pending.card.question ?? ''}).`,
      );
    } else {
      next = this.actions.applyPollutionTick(next, 'Quiz raté', 1);
      next = this.core.appendLog(
        next,
        `${target?.username ?? 'Un joueur'} rate le quiz (${pending.card.memberName ?? pending.card.question ?? ''}).`,
      );
    }
    dameNatureLog('quiz.resolved', {
      playerId: pending.playerId,
      cardId: pending.card.memberId,
      correct,
      answer: payloadAnswer ?? null,
    });
    return this.advanceTurn(next);
  }

  private isBotId(id: number, state: GameStateEntity): boolean {
    const players = this.ensurePlayers(state);
    const found = players.find((p) => p.id === id);
    return found?.isBot ?? false;
  }

  private appendAction(state: GameStateEntity, entry: Omit<ActionLogEntry, 'timestamp'>): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const actionLog = this.actionLog.append(meta.actionLog, entry);
    return { ...state, metadata: { ...meta, actionLog } };
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const currentId = state.turn?.currentPlayerId ?? null;
    const meta = state.metadata as DameNatureMetadata;
    const pendingAsk = meta?.pendingAsk ?? null;
    const pendingQuiz = meta?.pendingQuiz ?? null;
    const actionPlayerId =
      pendingAsk?.targetId ?? pendingQuiz?.playerId ?? (typeof currentId === 'number' ? currentId : null);
    const actions = typeof actionPlayerId === 'number' ? this.getAvailableActions(state, actionPlayerId) : [];
    const players = this.ensurePlayers(state);
    const families = this.setup.families();
    const familyLabel = (familyId: string) => families.find((f) => f.id === familyId)?.name ?? familyId;
    const handLabel = (card: FamilyCard) => `${familyLabel(card.familyId)} - ${card.memberName}`;
    const playerViews = players.map((p) => {
      const isCurrent = currentId != null && p.id === currentId;
      return {
        id: p.id,
        username: p.username,
        hand: isCurrent ? (p.hand ?? []).map(handLabel) : [],
        books: isCurrent ? (p.books ?? []).map(familyLabel) : [],
        handCount: p.handCount ?? (p.hand ?? []).length,
        booksCount: (p.books ?? []).length,
      };
    });
    const extrasFromState = (state as GameStateEntity & { extras?: unknown }).extras;
    const baseExtras =
      extrasFromState && typeof extrasFromState === 'object' ? (extrasFromState as Record<string, unknown>) : {};
    const currentPlayerView = typeof currentId === 'number' ? playerViews.find((v) => v.id === currentId) ?? null : null;
    const shortcuts: any[] = [
      { key: 'pressed D', type: 'action', actionType: 'ask_card' },
      { key: 'pressed C', type: 'interface', id: 'hand' },
      { key: 'pressed F', type: 'interface', id: 'books' },
    ];
    const pending = pendingAsk;
    if (pending && actionPlayerId != null && pending.targetId === actionPlayerId) {
      shortcuts.push({ key: 'pressed A', type: 'action', actionType: 'answer_ask_card_accept' });
      shortcuts.push({ key: 'pressed R', type: 'action', actionType: 'answer_ask_card_refuse' });
    }
    if (pendingQuiz && actionPlayerId != null && pendingQuiz.playerId === actionPlayerId) {
      shortcuts.push({ key: 'pressed A', type: 'action', actionType: 'answer_quiz_correct' });
      shortcuts.push({ key: 'pressed R', type: 'action', actionType: 'answer_quiz_wrong' });
    }
    const pendingState = pendingQuiz
      ? {
          type: 'quiz',
          question: pendingQuiz.card?.question ?? pendingQuiz.card?.memberName ?? 'Quiz',
          choices: pendingQuiz.card?.choices ?? ['Bonne réponse', 'Mauvaise réponse'],
          playerId: pendingQuiz.playerId,
        }
      : pendingAsk
      ? { type: 'ask_card', playerId: pendingAsk.fromId, targetPlayerId: pendingAsk.targetId, blocking: true }
      : null;
    return {
      ...(state as any),
      catalog: {
        phases: DAME_NATURE_PHASES.map((p) => p.id),
        victory: DAME_NATURE_VICTORY,
      },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: pendingState,
      extras: {
        ...baseExtras,
        playerViews,
        currentPlayerView,
        hand: currentPlayerView?.hand ?? [],
        handCards: currentPlayerView && currentId != null
          ? players.find((p) => p.id === currentId)?.hand?.map((c) => ({
              familyId: c.familyId,
              memberId: c.memberId,
              label: handLabel(c),
            })) ?? []
          : [],
        books: currentPlayerView?.books ?? [],
        shortcuts,
        pendingAsk: (state.metadata as DameNatureMetadata)?.pendingAsk ?? null,
        pendingQuiz,
      },
    };
  }

  private advancePhase(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const current = meta.phaseId ?? 'turn';
    const result = this.phases.advance(state, meta, this.phaseOrder, current);
    const nextMeta: DameNatureMetadata = {
      ...(result.state.metadata as DameNatureMetadata),
      phaseId: result.phaseId,
    };
    return this.applyVictory({ ...result.state, metadata: nextMeta });
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const result = this.victory.evaluate(state, DAME_NATURE_VICTORY);
    if (!result || !result.finished) {
      return state;
    }
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const nextMeta: DameNatureMetadata = {
      ...meta,
      victoryId: result.conditionId,
      winnerId: result.winnerId ?? null,
    };
    const next: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
      turn: { currentPlayerId: null, direction: 1 as const },
    };
    const message =
      result.conditionId === 'books-goal'
        ? `Objectif atteint : ${meta.familyGoal} familles complétées.`
        : 'Pollution maximale atteinte.';
    return this.core.appendLog(next, message);
  }

  private applyPollutionTick(state: GameStateEntity, reason: string, amount = 1): GameStateEntity {
    // Compat : délégation vers le service d'actions
    return this.actions.applyPollutionTick(state, reason, amount);
  }
}
