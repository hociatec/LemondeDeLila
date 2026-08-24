import { QuizState } from '../../../../application/features/quiz/services/quiz-runner.service';
import { BotProfile } from '../../../../application/services/bot-strategy.service';
import { DeckPoolState } from '../../../../application/services/deck-pool.service';
import { PlayerStateEntity } from '../../../../application/models/game-state.model';
import type { InteractiveExchangePending } from '../../../../application/features/exchange/models/interactive-exchange.model';

/**
 * Types des tuiles Panier Express
 */
export type PanierExpressTile =
  | { id: string; type: 'start'; label?: string; description?: string }
  | { id: string; type: 'rest'; label?: string; description?: string }
  | {
      id: string;
      type: 'stand';
      standId: string;
      label?: string;
      description?: string;
    }
  | { id: string; type: 'event'; label?: string; description?: string }
  | { id: string; type: 'exchange'; label?: string; description?: string }
  | { id: string; type: 'quiz'; label?: string; description?: string }
  | {
      id: string;
      type: 'move';
      delta: number;
      label?: string;
      description?: string;
    }
  | {
      id: string;
      type: 'move_choice';
      delta: number;
      label?: string;
      description?: string;
    }
  | {
      id: string;
      type: 'skip';
      turns?: number;
      label?: string;
      description?: string;
    }
  | { id: string; type: 'bonus_course'; label?: string; description?: string }
  | { id: string; type: 'move_to_stand'; label?: string; description?: string };

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
  payload?: Record<string, unknown>;
  timestamp: number;
};

export type PanierExpressQuizOutcomeEntry = {
  correct: boolean;
  message: string;
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
  pawn?: string;
}

/**
 * Échange en attente
 */
export type PanierExpressPendingExchange = InteractiveExchangePending;

/**
 * Métadonnées Panier Express
 */
export type PanierExpressMetadata = {
  rng?: Record<string, unknown>;
  stands: string[];
  tiles: PanierExpressTile[];
  decks: PanierExpressDeckPool;
  shoppingLists?: Record<number, string[]>;
  positions: Record<number, number>;
  /**
   * Nombre de tours de plateau complétés par joueur (passages sur la case départ).
   * 0 => le joueur est sur son tour de plateau 1.
   */
  laps: Record<number, number>;
  winnerId: number | null;
  quiz: QuizState;
  quizOutcome: Record<number, PanierExpressQuizOutcomeEntry>;
  actionLog: PanierExpressActionLogEntry[];
  botProfile: BotProfile;
  movementDirection?: 1 | -1;
  movementDirectionOwnerId?: number | null;
  pawnAnnouncementsDone?: boolean;
  shoppingListAnnouncementsDone?: boolean;
  starterChosenAfterPawnSelection?: boolean;
  lastObtainedCourse?: Record<number, string | null>;
  discards?: {
    courses?: string[];
  };
  statuses: {
    skipTurn: Record<number, number>;
    keepTurn?: Record<number, number>;
    revealInventory?: Record<number, number>;
    revealShoppingList?: Record<number, number>;
    noDrawCourses?: Record<number, number>;
  };
};
