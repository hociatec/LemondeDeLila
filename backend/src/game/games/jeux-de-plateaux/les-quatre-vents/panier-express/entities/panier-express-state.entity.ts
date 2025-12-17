import { QuizState } from '../../../../../modules/quiz/services/quiz-runner.service';
import { BotProfile } from '../../../../../modules/bot/services/bot-strategy.service';
import { DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { PendingState, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';

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

export type PanierExpressDeckPool = DeckPoolState<unknown>;

export type PanierExpressActionLogEntry = { type: string; actorId: number | null; payload?: unknown; timestamp: number };

export type PanierExpressPlayerState = PlayerStateEntity & {
  shoppingList: string[];
  basket: string[];
  inventory: string[];
};

export type PanierExpressPlayer = PanierExpressPlayerState;

export type PanierExpressPendingExchange = PendingState & {
  type: 'exchange';
  playerId: number;
  card: string;
};

export type PanierExpressMetadata = {
  stands: string[];
  tiles: PanierExpressTile[];
  decks: PanierExpressDeckPool;
  positions: Record<number, number>;
  winnerId: number | null;
  quiz: QuizState;
  actionLog: PanierExpressActionLogEntry[];
  botProfile: BotProfile;
  statuses: {
    skipTurn: Record<number, number>;
  };
};
