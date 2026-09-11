import { defineGamePhases } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { GerardState } from './state';

export const NAME_HANDS = 'names';

export const SPECIAL_HANDS = 'specials';

export const GERARD_EXTRA_NAMES = 'gerard.extra-names';

export const GERARD_DEFENSE = 'gerard.defense';

export const GERARD_SPECIAL_ATTACKERS = 'gerard.special-attackers';

export const GERARD_THEME_SECRET = 'gerard.theme-secret';

export const GERARD_JURY_OVERRIDE = 'gerard.jury-override';

export const GERARD_GHOST_NAMES = 'gerard.ghost-names';

export const GERARD_SUBMISSIONS = 'gerard.names';

export const GERARD_JUDGE = 'gerard.judge';

export const GERARD_TARGET_SCORE = 7;

export type RuleContext = GameContext<GerardState>;

export type SpecialInput = {
  cardId: string;
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
};

export const GERARD_PHASES = defineGamePhases<GerardState>()({
  initialPhase: 'waiting-theme',
  phases: {
    'waiting-theme': { transitions: ['collecting-names', 'choosing-winner'] },
    'collecting-names': { transitions: ['choosing-winner'] },
    'choosing-winner': { transitions: ['waiting-theme', 'collecting-names'] },
  },
});
