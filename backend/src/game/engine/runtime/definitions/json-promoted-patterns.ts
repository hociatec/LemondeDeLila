import type { GamePattern } from '../contracts/pattern-definition';
import type { AuthorSchema } from '../contracts/json-author-schema';
import {
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import type { BoardGameProgram } from '../patterns/board-movement-landings/program';
import { jsonBoardSchema } from '../patterns/board-movement-landings/json-board-schema';
import type { PathWallsProgram } from '../patterns/board-path-walls/program';
import { jsonPathWallsSchema } from '../patterns/board-path-walls/json-path-walls-schema';
import type { PropertyEconomyProgram } from '../patterns/board-property-economy/program';
import { jsonPropertyEconomySchema } from '../patterns/board-property-economy/json-property-economy-schema';
import type { DiscardPenaltyCardsProgram } from '../patterns/cards-discard-penalty/program';
import { jsonDiscardPenaltyCardsSchema } from '../patterns/cards-discard-penalty/json-discard-penalty-cards-schema';
import type { RitualPhasesProgram } from '../patterns/cards-ritual-phases/program';
import { jsonRitualPhasesSchema } from '../patterns/cards-ritual-phases/json-ritual-phases-schema';
import type { ThemeNameCardsProgram } from '../patterns/cards-theme-name/program';
import { jsonThemeNameCardsSchema } from '../patterns/cards-theme-name/json-theme-name-cards-schema';
import type { ChapterEncounterProgram } from '../patterns/choice-chapter-encounter/program';
import { jsonChapterEncounterSchema } from '../patterns/choice-chapter-encounter/json-chapter-encounter-schema';
import type { PawScoringProgram } from '../patterns/choice-simultaneous-paw-scoring/program';
import { jsonPawScoringSchema } from '../patterns/choice-simultaneous-paw-scoring/json-paw-scoring-schema';
import type { SimultaneousQuizProgram } from '../patterns/choice-simultaneous-quiz/program';
import { jsonSimultaneousQuizSchema } from '../patterns/choice-simultaneous-quiz/json-simultaneous-quiz-schema';
import type { StoryChallengeProgram } from '../patterns/choice-story-challenge/program';
import { jsonStoryChallengeSchema } from '../patterns/choice-story-challenge/json-story-challenge-schema';
import type { DirectionalHazardRaceProgram } from '../patterns/race-directional-hazards/program';
import { jsonDirectionalHazardRaceSchema } from '../patterns/race-directional-hazards/json-directional-hazard-race-schema';
import {
  boardMovementLandingsPattern,
  chapterEncounterPattern,
  directionalHazardPattern,
  discardPenaltyPattern,
  pathWallsPattern,
  pawScoringPattern,
  propertyEconomyPattern,
  ritualPhasesPattern,
  simultaneousQuizPattern,
  storyChallengePattern,
  themeNamePattern,
} from '../patterns/promoted-catalog-patterns';

type PromotedPattern<TKind extends string, TConfig, TAction extends string> = {
  kind: TKind;
  config: TConfig;
  actionIds: Readonly<Record<TAction, string>>;
};

export type PromotedJsonGamePattern =
  | PromotedPattern<
      'board-movement-landings',
      BoardGameProgram,
      'roll' | 'draw'
    >
  | PromotedPattern<'path-walls', PathWallsProgram, 'move' | 'placeWall'>
  | PromotedPattern<
      'property-economy',
      PropertyEconomyProgram,
      | 'roll'
      | 'build'
      | 'sell'
      | 'mortgage'
      | 'unmortgage'
      | 'payFine'
      | 'useJailCard'
    >
  | PromotedPattern<
      'discard-penalty',
      DiscardPenaltyCardsProgram,
      'play' | 'draw' | 'pass' | 'quit'
    >
  | PromotedPattern<'ritual-phases', RitualPhasesProgram, 'ask' | 'pass'>
  | PromotedPattern<
      'theme-name',
      ThemeNameCardsProgram,
      'setTheme' | 'playName' | 'playSpecial' | 'chooseWinner' | 'pass'
    >
  | PromotedPattern<'chapter-encounter', ChapterEncounterProgram, 'roll'>
  | PromotedPattern<
      'paw-scoring',
      PawScoringProgram,
      'draw' | 'play' | 'discard'
    >
  | PromotedPattern<'story-challenge', StoryChallengeProgram, 'roll'>
  | PromotedPattern<'directional-hazard', DirectionalHazardRaceProgram, 'roll'>
  | { kind: 'simultaneous-quiz'; config: SimultaneousQuizProgram };

const schema = (
  kind: string,
  config: AuthorSchema,
  actions: readonly string[],
): AuthorSchema =>
  object(
    {
      kind: { const: kind },
      config,
      actionIds: object(
        Object.fromEntries(actions.map((action) => [action, id])),
        actions,
      ),
    },
    ['kind', 'config', 'actionIds'],
  );

export const promotedJsonPatternSchemas: readonly AuthorSchema[] = [
  schema('board-movement-landings', jsonBoardSchema, ['roll', 'draw']),
  schema('path-walls', jsonPathWallsSchema, ['move', 'placeWall']),
  schema('property-economy', jsonPropertyEconomySchema, [
    'roll',
    'build',
    'sell',
    'mortgage',
    'unmortgage',
    'payFine',
    'useJailCard',
  ]),
  schema('discard-penalty', jsonDiscardPenaltyCardsSchema, [
    'play',
    'draw',
    'pass',
    'quit',
  ]),
  schema('ritual-phases', jsonRitualPhasesSchema, ['ask', 'pass']),
  schema('theme-name', jsonThemeNameCardsSchema, [
    'setTheme',
    'playName',
    'playSpecial',
    'chooseWinner',
    'pass',
  ]),
  schema('chapter-encounter', jsonChapterEncounterSchema, ['roll']),
  schema('paw-scoring', jsonPawScoringSchema, ['draw', 'play', 'discard']),
  schema('story-challenge', jsonStoryChallengeSchema, ['roll']),
  schema('directional-hazard', jsonDirectionalHazardRaceSchema, ['roll']),
  object(
    {
      kind: { const: 'simultaneous-quiz' },
      config: jsonSimultaneousQuizSchema,
    },
    ['kind', 'config'],
  ),
];

const promotedKinds: readonly string[] = [
  'board-movement-landings',
  'path-walls',
  'property-economy',
  'discard-penalty',
  'ritual-phases',
  'theme-name',
  'chapter-encounter',
  'paw-scoring',
  'story-challenge',
  'directional-hazard',
  'simultaneous-quiz',
];

export function isPromotedJsonPattern(pattern: {
  kind: string;
}): pattern is PromotedJsonGamePattern {
  return promotedKinds.includes(pattern.kind);
}

export function compilePromotedJsonPattern(
  pattern: PromotedJsonGamePattern,
): GamePattern<Record<string, never>> {
  switch (pattern.kind) {
    case 'board-movement-landings':
      return boardMovementLandingsPattern(pattern);
    case 'path-walls':
      return pathWallsPattern(pattern);
    case 'property-economy':
      return propertyEconomyPattern(pattern);
    case 'discard-penalty':
      return discardPenaltyPattern(pattern);
    case 'ritual-phases':
      return ritualPhasesPattern(pattern);
    case 'theme-name':
      return themeNamePattern(pattern);
    case 'chapter-encounter':
      return chapterEncounterPattern(pattern);
    case 'paw-scoring':
      return pawScoringPattern(pattern);
    case 'story-challenge':
      return storyChallengePattern(pattern);
    case 'directional-hazard':
      return directionalHazardPattern(pattern);
    case 'simultaneous-quiz':
      return simultaneousQuizPattern(pattern);
  }
}
