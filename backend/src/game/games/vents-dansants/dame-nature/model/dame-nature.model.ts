import type { DeckPoolState } from '../../../../modules/cards/services/deck-pool.service';
import type { ActionLogEntry } from '../../../../modules/actionlog/services/action-log.service';
import type { PlayerStateEntity } from '../../../../core/entities/game-state.entity';

export type FamilyCard = {
  kind?: 'family' | 'quiz' | 'danger';
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
  question?: string;
  answer?: string;
  choices?: string[];
  pollutionDelta?: number;
};

export type DameNatureMetadata = {
  gameType?: string;
  decks: DeckPoolState<FamilyCard>;
  familyGoal: number;
  maxPollution: number;
  pollutionByPlayer?: Record<string, number>;
  catalog: { families: { id: string; name: string }[] };
  actionLog: ActionLogEntry[];
  phaseId?: string;
  turnProgress?: {
    playerId: number;
    drew: boolean;
    discarded: boolean;
    asked: boolean;
  } | null;
  botProfile?: import('../../../../modules/bot/services/bot-strategy.service').BotProfile;
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
  pendingRefill?: {
    playerId: number;
    remaining: number;
  } | null;
};

export type DameNaturePlayer = PlayerStateEntity & {
  hand: FamilyCard[];
  handCount: number;
  books: string[];
};
