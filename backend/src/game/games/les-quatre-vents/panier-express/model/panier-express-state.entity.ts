import { QuizState } from '../../../../modules/quiz/services/quiz-runner.service';
import { BotProfile } from '../../../../modules/bot/services/bot-strategy.service';
import { DeckPoolState } from '../../../../modules/cards/services/deck-pool.service';
import { PlayerStateEntity } from '../../../../core/entities/game-state.entity';
import type { InteractiveExchangePending } from '../../../../modules/exchange/model/interactive-exchange.model';

/**
 * Types des tuiles Panier Express
 */
export type PanierExpressTile =
  | { id: string; type: 'start' }
  | { id: string; type: 'stand'; standId: string }
  | { id: string; type: 'event' }
  | { id: string; type: 'exchange' }
  | { id: string; type: 'quiz' }
  | { id: string; type: 'move'; delta: number }
  | { id: string; type: 'skip'; turns?: number }
  | { id: string; type: 'bonus_course' }
  | { id: string; type: 'move_to_stand' };

/**
 * Deck pool Panier Express
 */
export type PanierExpressDeckPool = DeckPoolState<unknown>;

/**
 * Entrée du journal d'actions
 */
export type PanierExpressActionLogEntry = {
  type: string;
  actorId: number | null;
  payload?: unknown;
  timestamp: number;
};

/**
 * Joueur Panier Express
 *
 * IMPORTANT :
 * On supprime les champs mal typés hérités de PlayerStateEntity
 * et on les redéfinit correctement en string[]
 */
export interface PanierExpressPlayer extends Omit<
  PlayerStateEntity,
  'shoppingList' | 'basket' | 'inventory'
> {
  shoppingList: string[];
  basket: string[];
  inventory: string[];
}

/**
 * Échange en attente
 */
export type PanierExpressPendingExchange = InteractiveExchangePending;

/**
 * Métadonnées Panier Express
 */
export type PanierExpressMetadata = {
  stands: string[];
  tiles: PanierExpressTile[];
  decks: PanierExpressDeckPool;
  positions: Record<number, number>;
  /**
   * Nombre de tours de plateau complétés par joueur (passages sur la case départ).
   * 0 => le joueur est sur son tour de plateau 1.
   */
  laps: Record<number, number>;
  winnerId: number | null;
  quiz: QuizState;
  actionLog: PanierExpressActionLogEntry[];
  botProfile: BotProfile;
  statuses: {
    skipTurn: Record<number, number>;
  };
};
