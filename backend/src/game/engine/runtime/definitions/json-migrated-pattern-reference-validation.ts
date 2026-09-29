import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { assertProtectedHauntedRaceReferences } from './json-protected-haunted-race-reference-validation';
import { assertSharedPrestigeCardsReferences } from './json-shared-prestige-cards-pattern-schema';
import { assertResourceTrackRaceReferences } from './json-resource-track-race-pattern-schema';
import { assertChainedTileRaceReferences } from './json-chained-tile-race-pattern-schema';
import { AuthoringError } from '../contracts/authoring-error';
import { assertBoardReferences } from '../patterns/board-movement-landings/json-board-schema';
import { assertPathWallsReferences } from '../patterns/board-path-walls/json-path-walls-schema';
import { assertPropertyEconomyReferences } from '../patterns/board-property-economy/json-property-economy-schema';
import { assertDiscardPenaltyCardsReferences } from '../patterns/cards-discard-penalty/json-discard-penalty-cards-schema';
import { assertRitualPhasesReferences } from '../patterns/cards-ritual-phases/json-ritual-phases-schema';
import { assertThemeNameCardsReferences } from '../patterns/cards-theme-name/json-theme-name-cards-schema';
import { assertChapterEncounterReferences } from '../patterns/choice-chapter-encounter/json-chapter-encounter-schema';
import { assertPawScoringReferences } from '../patterns/choice-simultaneous-paw-scoring/json-paw-scoring-schema';
import { assertSimultaneousQuizReferences } from '../patterns/choice-simultaneous-quiz/json-simultaneous-quiz-schema';
import { assertStoryChallengeReferences } from '../patterns/choice-story-challenge/json-story-challenge-schema';
import { assertDirectionalHazardRaceReferences } from '../patterns/race-directional-hazards/json-directional-hazard-race-schema';

type Failure = (path: string, reason: string) => never;
type Context = {
  components: readonly GameComponentDefinition[];
  resources: ReadonlySet<string>;
  counters: ReadonlySet<string>;
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>;
  initialPhase: string;
  maximumPlayers: number;
  fail: Failure;
};

function remapPromotedPatternError(
  error: unknown,
  index: number,
  legacyKey: string,
): never {
  if (!(error instanceof AuthoringError)) throw error;
  const prefix = `game.json.${legacyKey}`;
  const suffix = error.path.startsWith(prefix)
    ? error.path.slice(prefix.length)
    : '';
  throw new AuthoringError(
    `game.json.patterns[${index}].config${suffix}`,
    error.expected,
    error.received,
    error.message,
    error.hint,
  );
}

/**
 * Validate source-only invariants before generated components can report a
 * less useful composition path for the same authoring mistake.
 */
export function assertMigratedPatternSourceReferences(
  patterns: readonly JsonGamePattern[] | undefined,
  resources: ReadonlySet<string>,
): void {
  const legacyKeys: Partial<Record<JsonGamePattern['kind'], string>> = {
    'path-walls': 'pathWalls',
    'property-economy': 'propertyEconomy',
    'discard-penalty': 'discardPenaltyCards',
    'ritual-phases': 'ritualPhases',
    'theme-name': 'themeNameCards',
    'paw-scoring': 'pawScoring',
    'simultaneous-quiz': 'patterns',
    'story-challenge': 'storyChallenge',
  };
  for (const [index, pattern] of (patterns ?? []).entries()) {
    try {
      switch (pattern.kind) {
        case 'path-walls':
          assertPathWallsReferences(pattern.config);
          break;
        case 'property-economy':
          assertPropertyEconomyReferences(pattern.config);
          break;
        case 'discard-penalty':
          assertDiscardPenaltyCardsReferences(pattern.config);
          break;
        case 'ritual-phases':
          assertRitualPhasesReferences(pattern.config);
          break;
        case 'theme-name':
          assertThemeNameCardsReferences(pattern.config);
          break;
        case 'paw-scoring':
          assertPawScoringReferences(pattern.config);
          break;
        case 'simultaneous-quiz':
          assertSimultaneousQuizReferences(pattern.config);
          break;
        case 'story-challenge':
          assertStoryChallengeReferences(pattern.config, resources);
          break;
        default:
          continue;
      }
    } catch (error) {
      const legacyKey = legacyKeys[pattern.kind];
      if (!legacyKey) throw error;
      remapPromotedPatternError(error, index, legacyKey);
    }
  }
}

export function assertMigratedPatternReferences(
  pattern: JsonGamePattern,
  index: number,
  context: Context,
): void {
  const { components, resources, counters, fail } = context;
  if (pattern.kind === 'protected-haunted-race')
    assertProtectedHauntedRaceReferences(pattern, index, components, fail);
  if (pattern.kind === 'shared-prestige-cards')
    assertSharedPrestigeCardsReferences(pattern, components);
  if (pattern.kind === 'resource-track-race')
    assertResourceTrackRaceReferences(
      pattern.config,
      components,
      resources,
      counters,
    );
  if (pattern.kind === 'chained-tile-race')
    assertChainedTileRaceReferences(pattern.config, components);
  const validate = (legacyKey: string, run: () => void) => {
    try {
      run();
    } catch (error) {
      remapPromotedPatternError(error, index, legacyKey);
    }
  };
  if (pattern.kind === 'board-movement-landings') {
    validate('board', () =>
      assertBoardReferences(
        pattern.config,
        components,
        context.phases,
        context.initialPhase,
      ),
    );
    const selection = pattern.config.pawnSelection;
    const set = selection
      ? components.find(
          (component) =>
            component.component === 'pawn.set' &&
            component.id === selection.setId,
        )
      : undefined;
    if (
      selection &&
      (set?.component !== 'pawn.set' ||
        set.pawns.length < context.maximumPlayers * set.perPlayer)
    )
      fail(
        `patterns[${index}].config.pawnSelection.setId`,
        'not enough pawns for the maximum player count',
      );
  }
  if (pattern.kind === 'path-walls')
    validate('pathWalls', () => assertPathWallsReferences(pattern.config));
  if (pattern.kind === 'property-economy')
    validate('propertyEconomy', () =>
      assertPropertyEconomyReferences(pattern.config),
    );
  if (pattern.kind === 'discard-penalty')
    validate('discardPenaltyCards', () =>
      assertDiscardPenaltyCardsReferences(pattern.config),
    );
  if (pattern.kind === 'ritual-phases')
    validate('ritualPhases', () =>
      assertRitualPhasesReferences(pattern.config),
    );
  if (pattern.kind === 'theme-name')
    validate('themeNameCards', () =>
      assertThemeNameCardsReferences(pattern.config),
    );
  if (pattern.kind === 'chapter-encounter')
    validate('chapterEncounter', () =>
      assertChapterEncounterReferences(pattern.config, components),
    );
  if (pattern.kind === 'paw-scoring')
    validate('pawScoring', () => assertPawScoringReferences(pattern.config));
  if (pattern.kind === 'simultaneous-quiz')
    validate('patterns', () =>
      assertSimultaneousQuizReferences(pattern.config),
    );
  if (pattern.kind === 'story-challenge')
    validate('storyChallenge', () =>
      assertStoryChallengeReferences(pattern.config, resources),
    );
  if (pattern.kind === 'directional-hazard')
    validate('directionalHazardRace', () =>
      assertDirectionalHazardRaceReferences(
        pattern.config,
        components,
        resources,
        counters,
      ),
    );
}
