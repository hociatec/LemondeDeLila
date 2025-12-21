import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../core/services/game-core.service';
import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../core/entities/game-state.entity';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../../engine/abstract/abstract-game.service';
import { DeckPoolState } from '../../../../modules/cards/services/deck-pool.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { ActionResolverService } from '../../../../modules/action-resolver/services/action-resolver.service';
import {
  ActionLogService,
  ActionLogEntry,
} from '../../../../modules/actionlog/services/action-log.service';
import {
  PhaseEngineService,
  PhaseDefinition,
} from '../../../../modules/state/services/phase-engine.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import { dameNatureLog } from '../../../../../common/utils/damenature-logger';
import { DAME_NATURE_PHASES } from './definitions/rules.definition';
import { DAME_NATURE_VICTORY } from './definitions/victory.definition';
import { playingLog } from '../../../../../common/utils/playing-logger';
import { DameNatureSetupService } from './setup/dame-nature-setup.service';
import type { FamilyCard } from './model/dame-nature.model';
import { DameNatureActionService } from './actions/dame-nature-action.service';
import { DameNatureBotService } from './bots/dame-nature-bot.service';
import { DameNatureBooksService } from './actions/dame-nature-books.service';
import { DameNaturePhaseService } from './phases/dame-nature-phase.service';
import { DameNaturePresenterService } from './presenter/dame-nature-presenter.service';
import * as DameNatureRulebook from './rulebook/rulebook';
import type { BotProfile } from '../../../../modules/bot/services/bot-strategy.service';
import { ActionDispatcherService } from '../../../../engine/services/action-dispatcher.service';
import { DrawActionHandler } from './actions/draw.action-handler';
import { DiscardCardActionHandler } from './actions/discard.action-handler';
import { AskCardActionHandler } from './actions/ask-card.action-handler';
import { AnswerAskCardActionHandler } from './actions/answer-ask-card.action-handler';
import { AnswerQuizActionHandler } from './actions/answer-quiz.action-handler';

export type DameNatureMetadata = {
  // Métadonnées génériques consommées côté client (ex: filtrage des raccourcis).
  gameType?: string;
  decks: DeckPoolState<FamilyCard>;
  familyGoal: number;
  maxPollution: number;
  pollutionByPlayer?: Record<string, number>;
  catalog: { families: { id: string; name: string }[] };
  actionLog: ActionLogEntry[];
  phaseId?: string;
  // Un tour se termine uniquement après 1 pioche + 1 défausse (ordre libre).
  turnProgress?: {
    playerId: number;
    drew: boolean;
    discarded: boolean;
    asked: boolean;
  } | null;
  botProfile?: BotProfile;
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
export class DameNatureService extends AbstractGameService {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = 'Dame Nature';
  readonly description = 'Jeu de familles coopératif avec pollution et quiz.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;
  private readonly phaseOrder: PhaseDefinition<DameNatureMetadata>[] =
    DAME_NATURE_PHASES;
  private readonly dispatcher: ActionDispatcherService =
    new ActionDispatcherService();

  constructor(
    registry: GameRegistryService,
    private readonly core: GameCoreService,
    private readonly turns: TurnService,
    private readonly resolver: ActionResolverService,
    private readonly actionLog: ActionLogService,
    private readonly phases: PhaseEngineService<DameNatureMetadata>,
    private readonly victory: VictoryService,
    private readonly setup: DameNatureSetupService,
    private readonly actions: DameNatureActionService,
    private readonly bots: DameNatureBotService,
    private readonly books: DameNatureBooksService,
    private readonly phaseFlow: DameNaturePhaseService,
    private readonly presenter: DameNaturePresenterService,
  ) {
    super(registry);
    this.initializeActionHandlers();
  }

  /**
   * Initialise les handlers d'actions pour ce jeu.
   */
  private initializeActionHandlers(): void {
    // Wrapper functions pour les handlers qui conservent le contexte 'this'
    const wrapperDraw = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      this.log('action.draw', state, {
        type: action.type,
        userId: actorId,
        actorId,
        current: state.turn?.currentPlayerId ?? null,
      });
      return this.handleDraw(state, actorId);
    };

    const wrapperDiscard = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => this.handleDiscard(state, action, actorId);

    const wrapperAskCard = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      this.log('action.ask_card', state, {
        type: action.type,
        userId: actorId,
        actorId,
        current: state.turn?.currentPlayerId ?? null,
      });
      return this.handleAskCard(state, action, actorId);
    };

    const wrapperAnswerAskCard = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      this.log('action.answer_ask', state, {
        type: action.type,
        userId: actorId,
        actorId,
        pending: (state.metadata as DameNatureMetadata)?.pendingAsk ?? null,
      });
      return this.handleAnswerAskCard(state, action, actorId);
    };

    const wrapperAnswerAskCardAccept = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      const payload = { ...(action.payload ?? {}), accept: true };
      return this.handleAnswerAskCard(
        state,
        { ...action, type: 'answer_ask_card', payload },
        actorId,
      );
    };

    const wrapperAnswerAskCardRefuse = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      const payload = { ...(action.payload ?? {}), accept: false };
      this.log('action.answer_ask', state, {
        type: action.type,
        userId: actorId,
        actorId,
        pending: (state.metadata as DameNatureMetadata)?.pendingAsk ?? null,
      });
      return this.handleAnswerAskCard(
        state,
        { ...action, type: 'answer_ask_card', payload },
        actorId,
      );
    };

    const wrapperAnswerQuiz = (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => {
      this.log('action.answer_quiz', state, {
        type: action.type,
        userId: actorId,
        actorId,
        pending: (state.metadata as DameNatureMetadata)?.pendingQuiz ?? null,
      });
      return this.handleQuizAnswer(state, action, actorId);
    };

    // Enregistrement des handlers
    this.dispatcher.registerMany([
      new DrawActionHandler(wrapperDraw),
      new DiscardCardActionHandler(wrapperDiscard),
      new AskCardActionHandler(wrapperAskCard),
      new AnswerAskCardActionHandler('answer_ask_card', wrapperAnswerAskCard),
      new AnswerAskCardActionHandler(
        'answer_ask_card_accept',
        wrapperAnswerAskCardAccept,
      ),
      new AnswerAskCardActionHandler(
        'answer_ask_card_refuse',
        wrapperAnswerAskCardRefuse,
      ),
      new AnswerQuizActionHandler(wrapperAnswerQuiz),
    ]);
  }

  private log(
    label: string,
    state: GameStateEntity | null,
    payload: Record<string, unknown>,
  ): void {
    const meta = (state?.metadata ?? {}) as any;
    dameNatureLog(label, {
      roomId: meta?.roomId ?? null,
      gameType: meta?.gameType ?? this.gameType,
      turnIndex: state?.turnIndex ?? null,
      currentPlayerId: state?.turn?.currentPlayerId ?? null,
      ...payload,
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    // Conserver les métadonnées génériques du moteur (ex: gameType, generatedAt).
    const seed = (baseState.metadata as any)?.rng?.seed;
    const metadata = {
      ...(baseState.metadata ?? {}),
      ...this.setup.buildMetadata(
        typeof seed === 'number' && Number.isFinite(seed) ? seed : null,
      ),
    } as DameNatureMetadata & Record<string, unknown>;
    const players = this.setup.initializePlayers(
      baseState,
      metadata,
    ) as PlayerExt[];
    const firstId = players[0]?.id ?? null;
    const initial: GameStateEntity = {
      ...baseState,
      players,
      status: baseState.status ?? 'open',
      turn: {
        currentPlayerId: firstId,
        direction: 1 as const,
      },
      turnIndex: players.length ? 0 : -1,
      metadata: {
        ...metadata,
        gameType: String((metadata as any)?.gameType ?? this.gameType),
        turnProgress:
          typeof firstId === 'number'
            ? { playerId: firstId, drew: false, discarded: false, asked: false }
            : null,
      },
    };
    this.log('init', initial, {
      type: 'init',
      status: initial.status,
      turnIndex: initial.turnIndex,
      players: players.map((p) => ({ id: p.id, bot: p.isBot })),
    });
    if (initial.turn?.currentPlayerId != null) {
      const current = players.find(
        (p) => p.id === initial.turn?.currentPlayerId,
      );
      this.log('turn.start', initial, {
        type: 'turn_start',
        userId: current?.id ?? null,
        turnIndex: initial.turnIndex,
        playerId: current?.id ?? null,
        username: current?.username ?? null,
      });
    }
    return initial;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.ensureMetadata(state);
    next = this.ensurePlayersState(next);
    next = this.resolver.apply(next, actions, (s, a) =>
      this.dispatchAction(s, a),
    );
    next = this.phaseFlow.applyVictory(next);
    // Si le tour reste sur un bot, marquer l'état comme botThinking pour déclencher le timer côté moteur
    if (
      next.turn?.currentPlayerId != null &&
      this.isBotId(next.turn.currentPlayerId, next)
    ) {
      next = { ...next, botThinking: true };
      const currentId = next.turn?.currentPlayerId ?? null;
      playingLog('damenature.bot.thinking', {
        roomId: (next.metadata as any)?.roomId ?? null,
        gameType: (next.metadata as any)?.gameType ?? this.gameType,
        userId: currentId,
        type: 'bot_thinking',
        currentPlayerId: currentId,
        turnIndex: next.turnIndex,
      });
    } else {
      next = { ...next, botThinking: false };
    }
    return next;
  }

  private dispatchAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (!action?.type) return state;

    let next = this.ensureStarted(state);
    // Verrou : seule l'action du joueur courant est acceptée, sauf réponse à une demande en attente.
    const pendingAsk = (next.metadata as DameNatureMetadata)?.pendingAsk;
    let actorId = this.extractActorId(action);
    // Sécurité : si une réponse de demande arrive sans actorId, on l'assigne à la cible attendue.
    if (
      actorId == null &&
      action.type.toLowerCase().startsWith('answer_ask_card') &&
      pendingAsk?.targetId != null
    ) {
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
      const isPendingTarget =
        pending && actorId != null && actorId === pending.targetId;
      const isQuizAnswer = action.type.toLowerCase() === 'answer_quiz';
      const isQuizTarget =
        pendingQuiz && actorId != null && actorId === pendingQuiz.playerId;
      if (pending && !(isAnswer && isPendingTarget)) {
        this.log('block.pending_ask', next, {
          type: action.type,
          userId: actorId,
          actorId,
          currentId,
          pending,
        });
        return next; // rien d'autre tant que la demande n'est pas résolue
      }
      if (pendingQuiz && (!isQuizAnswer || !isQuizTarget)) {
        this.log('block.pending_quiz', next, {
          type: action.type,
          userId: actorId,
          actorId,
          currentId,
          pendingQuiz,
        });
        return next; // bloqué tant que le joueur concerné n'a pas répondu
      }
      if (
        actorId != null &&
        actorId !== currentId &&
        !(isAnswer && isPendingTarget)
      ) {
        this.log('block.not_current_player', next, {
          type: action.type,
          userId: actorId,
          actorId,
          currentId,
          action: action.type,
        });
        return next;
      }
      const currentIsBot = this.isBotId(currentId, next);
      if (currentIsBot && actorId == null) {
        // On ignore toute action humaine quand c'est le tour du bot.
        this.log('block.bot_turn', next, {
          type: action.type,
          userId: actorId,
          currentId,
          action: action.type,
        });
        return next;
      }
    }

    // Dispatcher l'action vers le handler approprié
    try {
      next = this.dispatcher.dispatch(next, action, actorId);
    } catch (error) {
      // Si aucun handler n'est trouvé, logger l'erreur
      next = this.core.appendLog(next, `Action non gérée: ${action.type}`);
    }
    return this.phaseFlow.advance(next);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return DameNatureRulebook.getAvailableActions(
      this.ensurePlayersState(state),
      playerId,
    );
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return DameNatureRulebook.validateAction(
      this.ensurePlayersState(state),
      action,
      actorId,
    );
  }

  validateActor(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    return DameNatureRulebook.actorOverrideAllowed(
      this.ensurePlayersState(state),
      actions,
      actorId,
    );
  }

  private handleDraw(
    state: GameStateEntity,
    actorId: number | null,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current =
      currentId != null ? players.find((p) => p.id === currentId) : null;
    if (!current) {
      // Corriger un tour invalide en avançant
      const fixed = this.advanceTurn(state);
      return fixed;
    }
    const normalizedState: GameStateEntity = { ...state, players };
    const result = this.actions.handleDraw(normalizedState, current, meta);
    let next = this.appendAction(result.state, {
      actorId: actorId ?? current.id,
      type: 'draw',
      payload: { cardId: result.card?.memberId ?? null },
    });
    if (result.performed) {
      next = this.markTurnProgress(next, current.id, { drew: true });
    }
    if (result.skipAdvance) {
      return next;
    }
    return this.advanceTurn(next);
  }

  private handleDiscard(
    state: GameStateEntity,
    action: GameSingleActionDto,
    _actorId: number | null,
  ): GameStateEntity {
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current =
      currentId != null ? players.find((p) => p.id === currentId) : null;
    const memberId = action.payload?.memberId;
    if (!current || !memberId) return state;
    const card = current.hand.find((c) => c.memberId === String(memberId));
    if (!card) return state;
    current.hand = current.hand.filter((c) => c !== card);
    current.handCount = current.hand.length;
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const progressBefore = this.getTurnProgress(meta, current.id);
    const metadata = this.setup.discardCard(meta, card);
    let next: GameStateEntity = { ...state, players, metadata };
    next = this.core.appendLog(
      next,
      `${current.username} défausse ${card.memberName} (${card.familyName}).`,
    );
    // Option 1 : invariant serveur => ne jamais finir une action avec < 4 cartes si possible.
    // Après une défausse, on repioche automatiquement pour revenir à 4.
    const refill = this.actions.refillHandToFourWithCount(
      next,
      current as any,
      next.metadata as DameNatureMetadata,
    );
    next = refill.state;
    next = this.markTurnProgress(next, current.id, {
      discarded: true,
      drew: progressBefore.drew || refill.drew > 0,
    });
    return this.advanceTurn(next);
  }

  private handleAskCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const familyId = action.payload?.familyId;
    const memberId = action.payload?.memberId;
    const targetId =
      action.payload?.target ??
      action.payload?.targetPlayerId ??
      action.payload?.targetId;
    const offerMemberId =
      action.payload?.offerMemberId ??
      action.payload?.giveMemberId ??
      action.payload?.give ??
      action.payload?.offer ??
      null;
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current =
      currentId != null ? players.find((p) => p.id === currentId) : null;
    const target =
      typeof targetId === 'number'
        ? players.find((p) => p.id === targetId)
        : null;
    if (!current || !target || !familyId) {
      // Demande invalide : log mais ne pas avancer le tour.
      return this.appendAction(
        this.core.appendLog(
          state,
          `Demande invalide (adversaire ou famille manquants).`,
        ),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    if (meta.pendingAsk) {
      return state; // une demande est déjà en attente
    }
    // exiger un memberId précis
    const progress = this.getTurnProgress(meta, current.id);
    if (progress.asked) {
      return this.appendAction(
        this.core.appendLog(
          state,
          `Demande impossible : vous avez déjà demandé une carte ce tour.`,
        ),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    if (!offerMemberId) {
      return this.appendAction(
        this.core.appendLog(
          state,
          `Demande invalide (une carte offerte est requise).`,
        ),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    if (!memberId) {
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (carte précise requise).`),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    // vérifier que le demandeur possède la carte pour formuler la demande
    const families = this.setup.families();
    const fam = families.find((f) => f.id === String(familyId));
    const memberExists =
      fam?.members?.some((m) => m.id === String(memberId)) ?? false;
    if (!memberExists) {
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (carte inconnue).`),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    // vérifier que l'éventuelle carte offerte est bien dans la main du demandeur
    const validOffer = offerMemberId
      ? (current.hand.find((c) => c.memberId === String(offerMemberId)) ?? null)
      : null;
    if (offerMemberId && !validOffer) {
      return this.appendAction(
        this.core.appendLog(
          state,
          `Demande invalide (la carte offerte n'est pas dans votre main).`,
        ),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    const stateWithAsked: GameStateEntity = this.markTurnProgress(
      { ...state, players },
      current.id,
      { asked: true },
    );
    const pending = {
      fromId: current.id,
      targetId: target.id,
      familyId:
        typeof familyId === 'string' ? familyId : String(familyId ?? ''),
      memberId: String(memberId),
      offerMemberId: validOffer ? validOffer.memberId : null,
    };
    const hasCard = target.hand.some((c) => c.memberId === pending.memberId);
    if (!hasCard) {
      return this.appendAction(
        this.core.appendLog(
          stateWithAsked,
          `${target.username} n'a pas cette carte.`,
        ),
        {
          actorId: actorId ?? currentId ?? null,
          type: 'ask_card_invalid',
          payload: action.payload,
        },
      );
    }
    // Si la cible est un bot : résolution immédiate (accept si carte dispo).
    if (target.isBot) {
      const accept = hasCard;
      const responseAction: GameSingleActionDto = {
        type: 'answer_ask_card',
        payload: { accept, playerId: target.id },
      };
      const withPending: GameStateEntity = {
        ...stateWithAsked,
        metadata: {
          ...(stateWithAsked.metadata as any),
          pendingAsk: pending,
        },
        players,
      };
      const logged = this.appendAction(withPending, {
        actorId: actorId ?? currentId ?? null,
        type: 'ask_card',
        payload: pending,
      });
      this.log('ask.auto', logged, {
        type: 'ask_auto',
        userId: current.id,
        fromId: current.id,
        targetId: target.id,
        family: pending.familyId,
        member: pending.memberId ?? null,
        accept,
      });
      return this.handleAnswerAskCard(logged, responseAction, target.id);
    }

    const nextMeta: DameNatureMetadata = {
      ...(stateWithAsked.metadata as DameNatureMetadata),
      pendingAsk: pending,
    };
    // Le tour passe temporairement à la cible pour la réponse.
    let next: GameStateEntity = {
      ...stateWithAsked,
      metadata: nextMeta,
      players,
      pending: {
        type: 'ask_card',
        playerId: current.id,
        targetPlayerId: target.id,
        blocking: true,
      },
      turn: { currentPlayerId: target.id, direction: 1 as const },
    };
    next = this.appendAction(next, {
      actorId: actorId ?? currentId ?? null,
      type: 'ask_card',
      payload: pending,
    });
    const familyLabel = (fid: string) =>
      families.find((f) => f.id === fid)?.name ?? fid;
    const requestedLabel = `${familyLabel(pending.familyId)} - ${pending.memberId}`;
    const offerLabel = validOffer
      ? `${validOffer.memberName} (${validOffer.familyName})`
      : 'rien';
    next = this.core.appendLog(
      next,
      `${current.username} demande ${requestedLabel} à ${target.username} et offre ${offerLabel}.`,
    );
    this.log('ask.pending', next, {
      type: 'ask_pending',
      userId: current.id,
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
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    if (meta.pendingAsk || meta.pendingQuiz) {
      // Tant qu'une demande ou un quiz est en attente, ne pas avancer.
      return state;
    }
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentPlayer =
      typeof currentId === 'number'
        ? players.find((p) => p.id === currentId)
        : null;
    if (currentPlayer) {
      const progress = this.getTurnProgress(meta, currentPlayer.id);
      if (!progress.drew || !progress.discarded) {
        return state;
      }
      // Si la main du joueur courant dépasse 4, forcer la défausse uniquement.
      if ((currentPlayer.hand?.length ?? 0) > 4) {
        return state;
      }
    }
    const currentIndex =
      currentId != null
        ? players.findIndex((p) => p.id === currentId)
        : state.turnIndex;
    const next = this.turns.nextTurn(
      players as any,
      currentIndex >= 0 ? currentIndex : -1,
      {},
    );
    const updated: GameStateEntity = {
      ...state,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: 1 as const,
      },
      metadata: {
        ...(meta as any),
        turnProgress:
          typeof next.currentPlayerId === 'number'
            ? {
                playerId: next.currentPlayerId,
                drew: false,
                discarded: false,
                asked: false,
              }
            : null,
      },
    };
    this.log('turn', updated, {
      type: 'turn',
      userId: next.currentPlayerId,
      turnIndex: next.turnIndex,
      current: next.currentPlayerId,
    });
    const newCurrent = players.find((p) => p.id === next.currentPlayerId);
    if (newCurrent) {
      this.log('turn.start', updated, {
        type: 'turn_start',
        userId: newCurrent.id,
        turnIndex: next.turnIndex,
        playerId: newCurrent.id,
        username: newCurrent.username,
        hand: newCurrent.handCount,
        books: newCurrent.books.length,
      });
    }
    const advanced = this.advancePhase(updated);
    return this.applyVictory(advanced);
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const base = this.setup.buildMetadata();
    // Conserver les clés "hors DameNatureMetadata" (ex: gameType) présentes dans state.metadata.
    const raw = state.metadata ?? {};
    const meta = (state.metadata as DameNatureMetadata | undefined) ?? base;
    return {
      ...state,
      metadata: {
        ...raw,
        ...base,
        ...meta,
        gameType: String(
          (raw as any)?.gameType ?? (meta as any)?.gameType ?? this.gameType,
        ),
        actionLog: meta.actionLog ?? [],
        catalog: meta.catalog ?? base.catalog,
        decks: meta.decks ?? base.decks,
        phaseId: meta.phaseId ?? 'turn',
        turnProgress:
          meta.turnProgress != null
            ? meta.turnProgress
            : typeof state.turn?.currentPlayerId === 'number'
              ? {
                  playerId: state.turn.currentPlayerId,
                  drew: false,
                  discarded: false,
                  asked: false,
                }
              : null,
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

  private getTurnProgress(meta: DameNatureMetadata, playerId: number) {
    const current = meta.turnProgress;
    if (current && current.playerId === playerId) {
      return { ...current, asked: (current as any).asked ?? false };
    }
    return { playerId, drew: false, discarded: false, asked: false };
  }

  private markTurnProgress(
    state: GameStateEntity,
    playerId: number,
    patch: Partial<
      Pick<
        NonNullable<DameNatureMetadata['turnProgress']>,
        'drew' | 'discarded' | 'asked'
      >
    >,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const base = this.getTurnProgress(meta, playerId);
    const turnProgress = { ...base, ...patch };
    return {
      ...state,
      metadata: {
        ...(meta as any),
        turnProgress,
      },
    };
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
      metadata: {
        ...((state.metadata ?? {}) as any),
        gameType: String(
          ((state.metadata ?? {}) as any)?.gameType ?? this.gameType,
        ),
        turnProgress:
          typeof players[0]?.id === 'number'
            ? {
                playerId: players[0].id,
                drew: false,
                discarded: false,
                asked: false,
              }
            : null,
      },
    };
    this.log('start', next, {
      type: 'start',
      userId: next.turn?.currentPlayerId ?? null,
      turnIndex: next.turnIndex,
      current: next.turn?.currentPlayerId ?? null,
    });
    return this.advancePhase(next);
  }

  private handleAnswerAskCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
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
      next = this.core.appendLog(
        next,
        `${target.username} refuse de donner ${label} à ${asker.username}.`,
      );
      const cleared: DameNatureMetadata = { ...meta, pendingAsk: null };
      const requesterIndex = players.findIndex((p) => p.id === asker.id);
      const restored: GameStateEntity = {
        ...next,
        metadata: cleared,
        pending: null,
        turn: { currentPlayerId: asker.id, direction: 1 as const },
        turnIndex: requesterIndex >= 0 ? requesterIndex : next.turnIndex,
      };
      this.log('ask.refuse', restored, {
        type: 'ask_refuse',
        userId: target.id,
        targetId: target.id,
        fromId: asker.id,
        family: pending.familyId,
        member: pending.memberId ?? null,
      });
      // Retour au demandeur : le tour ne se termine qu'après pioche + défausse (ordre libre).
      return restored;
    }
    const match = target.hand.find((c) =>
      pending.memberId
        ? c.memberId === pending.memberId
        : c.familyId === pending.familyId,
    );
    if (match) {
      target.hand = target.hand.filter((c) => c !== match);
      target.handCount = target.hand.length;
      asker.hand.push(match);
      asker.handCount = asker.hand.length;
      // Transfert de la carte offerte (si fournie et encore en main).
      if (pending.offerMemberId) {
        const offer = asker.hand.find(
          (c) => c.memberId === pending.offerMemberId,
        );
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
          this.appendAction(next, {
            actorId: asker.id,
            type: 'book',
            payload: { families: booked.booked },
          }),
          `${asker.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
        );
        next = this.actions.refillHandToFour(
          next,
          asker as any,
          next.metadata as DameNatureMetadata,
        );
      }
    } else {
      next = this.core.appendLog(
        next,
        `${target.username} n'a pas ${pending.familyId} à donner.`,
      );
    }
    const cleared: DameNatureMetadata = {
      ...(((next.metadata as DameNatureMetadata) ?? meta) as any),
      pendingAsk: null,
    };
    const requesterIndex = players.findIndex((p) => p.id === asker.id);
    const restored: GameStateEntity = {
      ...next,
      metadata: cleared,
      pending: null,
      turn: { currentPlayerId: asker.id, direction: 1 as const },
      turnIndex: requesterIndex >= 0 ? requesterIndex : next.turnIndex,
    };
    // Retour au demandeur : le tour ne se termine qu'après pioche + défausse (ordre libre).
    return restored;
  }

  private handleQuizAnswer(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const pending = meta.pendingQuiz;
    if (!pending) return state;
    if (actorId == null || actorId !== pending.playerId) {
      return state; // seul le joueur concerné peut répondre
    }
    const players = this.ensurePlayers(state);
    const target = players.find((p) => p.id === pending.playerId);
    const payloadAnswer =
      typeof action.payload?.answer === 'string' ? action.payload.answer : null;
    const answerIsCorrect = (candidate: string | null | undefined) =>
      (candidate ?? '').trim().toLowerCase() ===
      (pending.card.answer ?? '').trim().toLowerCase();
    const correct = answerIsCorrect(payloadAnswer);
    const clearedMeta: DameNatureMetadata = { ...meta, pendingQuiz: null };
    let next: GameStateEntity = {
      ...state,
      metadata: clearedMeta,
      players: this.ensurePlayers(state),
      pending: null,
    };
    if (correct) {
      next = this.applyPollutionTick(
        next,
        { id: pending.playerId, username: target?.username ?? 'Un joueur' },
        'Quiz réussi',
        -1,
      );
      next = this.core.appendLog(
        next,
        `${target?.username ?? 'Un joueur'} réussit le quiz (${pending.card.memberName ?? pending.card.question ?? ''}).`,
      );
    } else {
      next = this.applyPollutionTick(
        next,
        { id: pending.playerId, username: target?.username ?? 'Un joueur' },
        'Quiz raté',
        1,
      );
      next = this.core.appendLog(
        next,
        `${target?.username ?? 'Un joueur'} rate le quiz (${pending.card.memberName ?? pending.card.question ?? ''}).`,
      );
    }
    this.log('quiz.resolved', next, {
      type: 'answer_quiz',
      userId: actorId,
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

  private appendAction(
    state: GameStateEntity,
    entry: Omit<ActionLogEntry, 'timestamp'>,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const actionLog = this.actionLog.append(meta.actionLog, entry);
    return { ...state, metadata: { ...meta, actionLog } };
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return this.presenter.exposeState(state);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  private advancePhase(state: GameStateEntity): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
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
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
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

  private applyPollutionTick(
    state: GameStateEntity,
    player: { id: number; username: string },
    reason: string,
    amount = 1,
  ): GameStateEntity {
    // Compat : délégation vers le service d'actions
    return this.actions.applyPollutionTick(state, player, reason, amount);
  }
}
