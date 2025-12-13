import { QuizState } from '../../../../../modules/quiz/services/quiz-runner.service';
import { BotProfile } from '../../../../../modules/bot/services/bot-strategy.service';

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

export type PanierExpressMetadata = {
  stands: string[];
  tiles: PanierExpressTile[];
  decks: Record<string, { deck: any[]; discards: any[] }>;
  positions: Record<number, number>;
  winnerId: number | null;
  quiz?: QuizState;
  actionLog?: { type: string; actorId: number | null; payload?: any; timestamp: number }[];
  botProfile?: BotProfile;
  statuses: {
    skipTurn: Record<number, number>;
  };
};
