import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import {
  DameNatureSetupService,
  FamilyCard,
} from './dame-nature-setup.service';
import { DameNatureBooksService } from './dame-nature-books.service';
import { DameNaturePollutionService } from './dame-nature-pollution.service';
import { DameNatureMetadata } from './dame-nature.service';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';

@Injectable()
export class DameNatureActionService {
  constructor(
    private readonly setup: DameNatureSetupService,
    private readonly books: DameNatureBooksService,
    private readonly pollution: DameNaturePollutionService,
    private readonly actionLog: ActionLogService,
    private readonly core: GameCoreService,
  ) {}

  handleDraw(
    state: GameStateEntity,
    current: {
      id: number;
      username: string;
      hand: FamilyCard[];
      handCount: number;
      books: string[];
    },
    meta: DameNatureMetadata,
  ) {
    // On autorise une main temporaire à 5 cartes (pioche puis défausse).
    if ((current.hand?.length ?? 0) >= 5) {
      return {
        state: this.core.appendLog(
          state,
          `${current.username} ne peut pas piocher (main pleine).`,
        ),
        card: null,
        performed: false,
      };
    }
    const { card, metadata } = this.setup.drawCard(meta);
    dameNatureLog('turn.state', {
      playerId: current.id,
      username: current.username,
      hand: current.handCount,
      books: current.books.length,
      pollution: this.pollution.get(meta, current.id),
      maxPollution: meta.maxPollution,
    });
    if (!card) {
      const logged = this.core.appendLog(
        state,
        `Pioche vide : ${current.username} passe son tour.`,
      );
      const polluted = this.applyPollutionTick(
        { ...logged, metadata },
        current,
        'Pioche vide',
      );
      dameNatureLog('draw.empty', {
        playerId: current.id,
        username: current.username,
        pollution: this.pollution.get(polluted.metadata as any, current.id),
      });
      return { state: polluted, card: null, performed: true };
    }
    if (card.kind === 'danger') {
      let next = this.core.appendLog(
        { ...state, metadata },
        `${current.username} pioche une carte Nature en danger : ${card.memberName}.`,
      );
      next = this.applyPollutionTick(
        next,
        current,
        card.memberName,
        card.pollutionDelta ?? 1,
      );
      const metaAfter = next.metadata as DameNatureMetadata;
      dameNatureLog('draw.danger', {
        playerId: current.id,
        username: current.username,
        cardId: card.memberId,
        cardName: card.memberName,
        delta: card.pollutionDelta ?? 1,
        pollution: this.pollution.get(metaAfter, current.id),
      });
      return { state: next, card, skipAdvance: false, performed: true };
    }
    if (card.kind === 'quiz') {
      // Si un bot pioche un quiz, auto-répondre (réponse correcte par défaut) pour éviter de bloquer.
      if ((current as any).isBot) {
        const correct = true;
        const answered = this.applyPollutionTick(
          { ...state, metadata },
          current,
          correct ? 'Quiz réussi (bot)' : 'Quiz raté (bot)',
          correct ? -1 : 1,
        );
        dameNatureLog('draw.quiz.bot', {
          playerId: current.id,
          username: current.username,
          cardId: card.memberId,
          question: card.question ?? card.memberName,
          auto: true,
          correct,
        });
        return { state: answered, card, skipAdvance: false, performed: true };
      }
      const pendingQuiz = { playerId: current.id, card };
      const withQuiz: GameStateEntity = {
        ...state,
        metadata: { ...metadata, pendingQuiz },
        pending: {
          type: 'quiz',
          playerId: current.id,
          question: card.question ?? card.memberName,
          choices: card.choices ?? ['Bonne réponse', 'Mauvaise réponse'],
          blocking: true,
        },
      };
      const logged = this.core.appendLog(
        withQuiz,
        `${current.username} pioche une carte Quiz : ${card.memberName}. Répondez pour résoudre l'effet.`,
      );
      dameNatureLog('draw.quiz', {
        playerId: current.id,
        username: current.username,
        cardId: card.memberId,
        question: card.question ?? card.memberName,
      });
      return { state: logged, card, skipAdvance: true, performed: true };
    }
    current.hand.push(card);
    current.handCount = current.hand.length;
    let next: GameStateEntity = {
      ...state,
      players: state.players,
      metadata,
    };
    next = this.core.appendLog(
      next,
      `${current.username} pioche ${card.familyName} - ${card.memberName}.`,
    );
    const booked = this.books.checkAndBook(next, current);
    next = booked.state;
    if (booked.booked.length) {
      next = this.core.appendLog(
        this.appendAction(next, {
          actorId: current.id,
          type: 'book',
          payload: { families: booked.booked },
        }),
        `${current.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
      );
      next = this.refillHandToFour(
        next,
        current,
        next.metadata as DameNatureMetadata,
      );
    }
    dameNatureLog('draw.family', {
      playerId: current.id,
      username: current.username,
      cardId: card.memberId,
      cardName: `${card.familyName} - ${card.memberName}`,
      hand: current.handCount,
      books: current.books.length,
    });
    return { state: next, card, performed: true };
  }

  refillHandToFour(
    state: GameStateEntity,
    player: {
      id: number;
      username: string;
      hand: FamilyCard[];
      handCount: number;
      books: string[];
    },
    meta: DameNatureMetadata,
  ): GameStateEntity {
    return this.refillHandToFourWithCount(state, player, meta).state;
  }

  refillHandToFourWithCount(
    state: GameStateEntity,
    player: {
      id: number;
      username: string;
      hand: FamilyCard[];
      handCount: number;
      books: string[];
    },
    meta: DameNatureMetadata,
  ): { state: GameStateEntity; drew: number } {
    let next = state;
    let currentMeta = meta;
    let drew = 0;
    while ((player.hand?.length ?? 0) < 4) {
      const draw = this.setup.drawFamilyCard(currentMeta);
      currentMeta = draw.metadata;
      if (!draw.card) break;
      player.hand.push(draw.card);
      player.handCount = player.hand.length;
      drew += 1;
    }
    next = { ...next, metadata: currentMeta, players: next.players };
    if (drew > 0) {
      next = this.core.appendLog(
        next,
        `${player.username} pioche ${drew} carte(s) pour revenir à 4.`,
      );
    }
    return { state: next, drew };
  }

  handleAskCard(
    state: GameStateEntity,
    params: {
      current: any;
      target: any;
      familyId: string;
      memberId?: string | null;
    },
  ): { state: GameStateEntity; success: boolean } {
    const { current, target, familyId, memberId } = params;
    if (!current || !target || !familyId) {
      const next = this.appendAction(
        this.core.appendLog(
          state,
          `Demande invalide (adversaire ou famille manquants).`,
        ),
        {
          actorId: current?.id ?? null,
          type: 'ask_card_invalid',
          payload: { familyId, memberId, target: target?.id },
        },
      );
      return { state: next, success: false };
    }
    const match = target.hand.find((c: FamilyCard) =>
      memberId ? c.memberId === memberId : c.familyId === familyId,
    );
    if (match) {
      target.hand = target.hand.filter((c: FamilyCard) => c !== match);
      target.handCount = target.hand.length;
      current.hand.push(match);
      current.handCount = current.hand.length;
      let next: GameStateEntity = { ...state, players: state.players };
      next = this.core.appendLog(
        next,
        `${current.username} obtient ${match.memberName} (${match.familyName}) de ${target.username}.`,
      );
      const booked = this.books.checkAndBook(next, current);
      next = booked.state;
      if (booked.booked.length) {
        next = this.core.appendLog(
          this.appendAction(next, {
            actorId: current.id,
            type: 'book',
            payload: { families: booked.booked },
          }),
          `${current.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
        );
        next = this.refillHandToFour(
          next,
          current,
          next.metadata as DameNatureMetadata,
        );
      }
      return { state: next, success: true };
    }
    const next = this.core.appendLog(
      state,
      `${current.username} demande ${familyId} à ${target.username} : refus.`,
    );
    return { state: next, success: true };
  }

  applyPollutionTick(
    state: GameStateEntity,
    player: { id: number; username: string },
    reason: string,
    amount = 1,
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const { metadata, reachedMax, delta, playerPollution } =
      this.pollution.tick(meta, player.id, amount);
    let next: GameStateEntity = { ...state, metadata };
    if (reason && delta !== 0) {
      const sign = delta > 0 ? '+' : '-';
      next = this.core.appendLog(
        next,
        `Pollution ${sign}${Math.abs(delta)} pour ${player.username} (${reason}). Total: ${playerPollution}/${metadata.maxPollution}.`,
      );
      dameNatureLog('pollution.tick', {
        playerId: player.id,
        username: player.username,
        reason,
        delta,
        total: playerPollution,
        max: metadata.maxPollution,
      });
    }
    if (reachedMax) {
      next = {
        ...next,
        status: 'finished',
        turn: { currentPlayerId: null, direction: 1 as const },
      };
      next = this.core.appendLog(
        next,
        'Pollution maximale atteinte. La partie est terminée.',
      );
    }
    return next;
  }

  private appendAction(
    state: GameStateEntity,
    entry: { actorId: number | null; type: string; payload?: any },
  ): GameStateEntity {
    const meta =
      (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const actionLog = this.actionLog.append(meta.actionLog, entry);
    return { ...state, metadata: { ...meta, actionLog } };
  }
}
