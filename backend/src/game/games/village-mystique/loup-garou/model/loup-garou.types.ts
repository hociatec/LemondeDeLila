import type { ActionLogEntry } from '../../../../modules/actionlog/services/action-log.service';
import type { BotProfile } from '../../../../modules/bot/services/bot-strategy.service';

export type GarouRole = 'werewolf' | 'seer' | 'witch' | 'cupid' | 'villager';

export type GarouStep =
  | 'seer'
  | 'cupid'
  | 'wolves'
  | 'witch'
  | 'resolve-night'
  | 'announce'
  | 'day-vote'
  | 'resolve-day'
  | 'check-victory';

export type GarouWinner = 'village' | 'wolves' | 'lovers';

export type GarouMetadata = {
  day: number;
  firstNight: boolean;
  step: GarouStep;
  roles: Record<number, GarouRole>;
  lovers: [number, number] | null;
  pending: {
    wolvesChoices: Record<number, number | null>;
    wolvesTarget: number | null;
    poisonTarget: number | null;
    seerUsed: boolean;
    witchUsed: boolean;
  };
  witchPotions: { healUsed: boolean; poisonUsed: boolean };
  votes: Record<number, number | null>;
  voteQueue: number[];
  nightDeaths: number[];
  lastAnnouncement: number[];
  winner?: GarouWinner | null;
  lastPeek?: { seerId: number; targetId: number; role: GarouRole };
  tiePolicy: 'no-kill' | 'random';
  actionLog: ActionLogEntry[];
  botProfile?: BotProfile;
  victoryId?: string | null;
};
