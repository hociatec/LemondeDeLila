import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import { DameNatureSetupService, FamilyCard } from './dame-nature-setup.service';
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
    current: { id: number; username: string; hand: FamilyCard[]; handCount: number; books: string[] },
    meta: DameNatureMetadata,
  ) {
    if ((current.hand?.length ?? 0) >= 4) {
      return { state: this.core.appendLog(state, `${current.username} ne peut pas piocher (main pleine).`), card: null };
    }
    const { card, metadata } = this.setup.drawCard(meta);
    dameNatureLog('turn.state', {
      playerId: current.id,
      username: current.username,
      hand: current.handCount,
      books: current.books.length,
      pollution: meta.pollution,
      maxPollution: meta.maxPollution,
    });
    if (!card) {
      let logged = this.core.appendLog(state, `Pioche vide : ${current.username} passe son tour.`);
      const polluted = this.applyPollutionTick({ ...logged, metadata }, 'Pioche vide');
      dameNatureLog('draw.empty', { playerId: current.id, username: current.username, pollution: (polluted.metadata as any)?.pollution ?? 0 });
      return { state: polluted, card: null };
    }
    if (card.kind === 'danger') {
      let next = this.core.appendLog(
        { ...state, metadata },
        `${current.username} pioche une carte Nature en danger : ${card.memberName}.`,
      );
      next = this.applyPollutionTick(next, card.memberName, card.pollutionDelta ?? 1);
      const metaAfter = next.metadata as DameNatureMetadata;
      dameNatureLog('draw.danger', {
        playerId: current.id,
        username: current.username,
        cardId: card.memberId,
        cardName: card.memberName,
        delta: card.pollutionDelta ?? 1,
        pollution: metaAfter.pollution,
      });
      return { state: next, card, skipAdvance: false };
    }
    if (card.kind === 'quiz') {
      // Si un bot pioche un quiz, auto-répondre (réponse correcte par défaut) pour éviter de bloquer.
      if ((current as any).isBot) {
        const correct = true;
        const answered = this.applyPollutionTick(
          { ...state, metadata },
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
        return { state: answered, card, skipAdvance: false };
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
      return { state: logged, card, skipAdvance: true };
    }
    current.hand.push(card);
    current.handCount = current.hand.length;
    let next: GameStateEntity = {
      ...state,
      players: state.players,
      metadata,
    };
    next = this.core.appendLog(next, `${current.username} pioche ${card.familyName} - ${card.memberName}.`);
    const booked = this.books.checkAndBook(next, current);
    next = booked.state;
    if (booked.booked.length) {
      next = this.core.appendLog(
        this.appendAction(next, { actorId: current.id, type: 'book', payload: { families: booked.booked } }),
        `${current.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
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
    return { state: next, card };
  }

  handleAskCard(
    state: GameStateEntity,
    params: { current: any; target: any; familyId: string; memberId?: string | null },
  ): { state: GameStateEntity; success: boolean } {
    const { current, target, familyId, memberId } = params;
    if (!current || !target || !familyId) {
      const next = this.appendAction(
        this.core.appendLog(state, `Demande invalide (adversaire ou famille manquants).`),
        { actorId: current?.id ?? null, type: 'ask_card_invalid', payload: { familyId, memberId, target: target?.id } },
      );
      return { state: next, success: false };
    }
    const match = target.hand.find((c: FamilyCard) => (memberId ? c.memberId === memberId : c.familyId === familyId));
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
          this.appendAction(next, { actorId: current.id, type: 'book', payload: { families: booked.booked } }),
          `${current.username} complète ${booked.booked.length} famille(s): ${booked.booked.join(', ')}.`,
        );
      }
      return { state: next, success: true };
    }
    let next = this.core.appendLog(
      state,
      `${current.username} demande ${familyId} à ${target.username} : refus.`,
    );
    return { state: next, success: true };
  }

  applyPollutionTick(state: GameStateEntity, reason: string, amount = 1): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const { metadata, reachedMax, delta } = this.pollution.tick(meta, amount);
    let next: GameStateEntity = { ...state, metadata };
    if (reason && delta !== 0) {
      const sign = delta > 0 ? '+' : '-';
      next = this.core.appendLog(
        next,
        `Pollution ${sign}${Math.abs(delta)} (${reason}). Total: ${metadata.pollution}/${metadata.maxPollution}.`,
      );
      dameNatureLog('pollution.tick', {
        reason,
        delta,
        total: metadata.pollution,
        max: metadata.maxPollution,
      });
    }
    if (reachedMax) {
      next = {
        ...next,
        status: 'finished',
        turn: { currentPlayerId: null, direction: 1 as const },
      };
      next = this.core.appendLog(next, 'Pollution maximale atteinte. La partie est terminée.');
    }
    return next;
  }

  private appendAction(state: GameStateEntity, entry: { actorId: number | null; type: string; payload?: any }): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.setup.buildMetadata();
    const actionLog = this.actionLog.append(meta.actionLog, entry);
    return { ...state, metadata: { ...meta, actionLog } };
  }
}
