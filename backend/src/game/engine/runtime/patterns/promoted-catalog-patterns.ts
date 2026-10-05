import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GamePattern } from '../contracts/pattern-definition';
import { composePatterns, definePattern } from './gameplay-pattern-core';
import { boardTurnRules } from './board-movement-landings/board-turn.recipes';
import type { BoardGameProgram } from './board-movement-landings/program';
import { pathWallsRules } from './board-path-walls/path-walls.recipes';
import type { PathWallsProgram } from './board-path-walls/program';
import { propertyEconomyRules } from './board-property-economy/property-economy.recipes';
import type { PropertyEconomyProgram } from './board-property-economy/program';
import { discardPenaltyCardsRules } from './cards-discard-penalty/discard-penalty-cards.recipes';
import type { DiscardPenaltyCardsProgram } from './cards-discard-penalty/program';
import { ritualPhasesRules } from './cards-ritual-phases/ritual-phases.recipes';
import type { RitualPhasesProgram } from './cards-ritual-phases/program';
import { themeNameCardsRules } from './cards-theme-name/theme-name-cards.recipes';
import type { ThemeNameCardsProgram } from './cards-theme-name/program';
import { chapterEncounterRules } from './choice-chapter-encounter/chapter-encounter.recipes';
import type { ChapterEncounterProgram } from './choice-chapter-encounter/program';
import { pawScoringRules } from './choice-simultaneous-paw-scoring/paw-scoring.recipes';
import type { PawScoringProgram } from './choice-simultaneous-paw-scoring/program';
import { simultaneousQuizRules } from './choice-simultaneous-quiz/simultaneous-quiz.recipes';
import type { SimultaneousQuizProgram } from './choice-simultaneous-quiz/program';
import { storyChallengeRules } from './choice-story-challenge/story-challenge.recipes';
import type { StoryChallengeProgram } from './choice-story-challenge/program';
import { directionalHazardRaceRules } from './race-directional-hazards/directional-hazard-race.recipes';
import type { DirectionalHazardRaceProgram } from './race-directional-hazards/program';

type State = Record<string, never>;
type ActionIds<T extends string> = Readonly<Record<T, string>>;

function withNestedPatterns(
  id: string,
  mechanic: string,
  nested: readonly GamePattern<State>[],
  contribution: Omit<GamePattern<State>, 'id' | 'mechanics'>,
): GamePattern<State> {
  const composed = composePatterns(...nested);
  return definePattern({
    ...composed,
    ...contribution,
    id,
    mechanics: [...composed.mechanics, mechanic],
    components: [
      ...(composed.components ?? []),
      ...(contribution.components ?? []),
    ],
  });
}

function mappedAction(
  available: readonly string[],
  actionIds: Readonly<Record<string, string>>,
  key: string | null,
  payload: object = {},
) {
  if (!key) return null;
  const type = actionIds[key];
  return type && available.includes(type) ? { type, payload } : null;
}

export function boardMovementLandingsPattern(input: {
  config: BoardGameProgram;
  actionIds: ActionIds<'roll' | 'draw'>;
}) {
  const compiled = boardTurnRules(input.config);
  return definePattern<State>({
    id: `board-movement-landings:${input.config.trackId}`,
    mechanics: ['board-movement-landings'],
    actions: { 'board-roll': compiled.roll, 'board-draw': compiled.draw },
    choices: compiled.choices,
    setup: compiled.setup,
    effects: compiled.effects,
    automatic: compiled.automatic,
    bot: {
      choose: ({ availableActions }) => {
        const type = availableActions.includes(input.actionIds.draw)
          ? input.actionIds.draw
          : availableActions[0];
        return type ? { type, payload: {} } : null;
      },
    },
  });
}

export function pathWallsPattern(input: {
  config: PathWallsProgram;
  actionIds: ActionIds<'move' | 'placeWall'>;
}) {
  const compiled = pathWallsRules(input.config);
  return withNestedPatterns(
    `path-walls:${input.config.boardId}`,
    'path-walls',
    compiled.patterns,
    {
      actions: {
        'board-path-walls-move': compiled.move,
        'board-path-walls-place-wall': compiled.placeWall,
      },
      components: compiled.components,
      initialization: compiled.initialization,
      config: compiled.config,
      choices: compiled.choices,
      bot: {
        choose: ({ actor, availableActions, ctx }) => {
          const turn = compiled.botTurn(actor.id, ctx);
          if (!turn) return null;
          return mappedAction(
            availableActions,
            input.actionIds,
            turn.kind === 'wall' ? 'placeWall' : 'move',
            turn.payload,
          );
        },
      },
    },
  );
}

export function propertyEconomyPattern(input: {
  config: PropertyEconomyProgram;
  actionIds: ActionIds<
    | 'roll'
    | 'build'
    | 'sell'
    | 'mortgage'
    | 'unmortgage'
    | 'payFine'
    | 'useJailCard'
  >;
}) {
  const compiled = propertyEconomyRules(input.config);
  return withNestedPatterns(
    'property-economy',
    'property-economy',
    compiled.patterns,
    {
      actions: {
        'board-property-economy-roll': compiled.roll,
        'board-property-economy-build': compiled.build,
        'board-property-economy-sell-building': compiled.sell,
        'board-property-economy-mortgage': compiled.mortgage,
        'board-property-economy-unmortgage': compiled.unmortgage,
        'board-property-economy-pay-fine': compiled.payFine,
        'board-property-economy-use-jail-card': compiled.useJailCard,
      },
      choices: compiled.choices,
      effects: compiled.effects,
      config: compiled.config,
      setup: compiled.setup,
      initialization: compiled.initialization,
      resourceIds: compiled.resourceIds,
      viewExtension: compiled.viewExtension,
      events: compiled.events,
      components: compiled.components.filter(
        (component) => component.component !== 'cards.zone',
      ),
      bot: {
        choose: ({ availableActions }) => {
          for (const key of ['useJailCard', 'payFine', 'roll'] as const) {
            const action = mappedAction(availableActions, input.actionIds, key);
            if (action) return action;
          }
          return null;
        },
      },
    },
  );
}

export function discardPenaltyPattern(input: {
  config: DiscardPenaltyCardsProgram;
  actionIds: ActionIds<'play' | 'draw' | 'pass' | 'quit'>;
}) {
  const compiled = discardPenaltyCardsRules(input.config);
  const recipes = {
    play: 'cards-discard-penalty-play',
    draw: 'cards-discard-penalty-draw',
    pass: 'cards-discard-penalty-pass',
    quit: 'cards-discard-penalty-quit',
  } as const;
  return withNestedPatterns(
    'discard-penalty',
    'discard-penalty',
    compiled.patterns,
    {
      actions: Object.fromEntries(
        Object.entries(recipes).map(([key, recipe]) => [
          recipe,
          compiled[
            key as keyof typeof compiled
          ] as GameActionMap<State>[string],
        ]),
      ),
      choices: compiled.choices,
      initialization: compiled.initialization,
      config: compiled.config,
      lifecycle: compiled.lifecycle,
      automatic: compiled.automatic,
      bot: {
        choose: ({ actor, availableActions, ctx }) => {
          const availableRecipes = Object.entries(input.actionIds)
            .filter(([, id]) => availableActions.includes(id))
            .map(([key]) => recipes[key as keyof typeof recipes]);
          const selected = compiled.chooseBot(actor.id, availableRecipes, ctx);
          if (!selected) return null;
          const key = Object.entries(recipes).find(
            ([, recipe]) => recipe === selected.recipe,
          )?.[0];
          return mappedAction(
            availableActions,
            input.actionIds,
            key ?? null,
            selected.payload,
          );
        },
      },
    },
  );
}

export function ritualPhasesPattern(input: {
  config: RitualPhasesProgram;
  actionIds: ActionIds<'ask' | 'pass'>;
}) {
  const compiled = ritualPhasesRules(input.config);
  return withNestedPatterns(
    'ritual-phases',
    'ritual-phases',
    compiled.patterns,
    {
      actions: {
        'cards-ritual-phases-ask-card': compiled.ask,
        'cards-ritual-phases-pass': compiled.pass,
      },
      choices: compiled.choices,
      effects: compiled.effects,
      lifecycle: compiled.lifecycle,
      components: compiled.components,
      bot: {
        choose: ({ actor, availableActions, ctx }) => {
          const selected = compiled.chooseBot(actor.id, ctx);
          return mappedAction(
            availableActions,
            input.actionIds,
            selected.recipe === 'cards-ritual-phases-ask-card' ? 'ask' : 'pass',
            selected.payload,
          );
        },
      },
    },
  );
}

export function themeNamePattern(input: {
  config: ThemeNameCardsProgram;
  actionIds: ActionIds<
    'setTheme' | 'playName' | 'playSpecial' | 'chooseWinner' | 'pass'
  >;
}) {
  const compiled = themeNameCardsRules(input.config);
  const recipes = {
    setTheme: 'cards-theme-name-set-theme',
    playName: 'cards-theme-name-play-name',
    playSpecial: 'cards-theme-name-play-special',
    chooseWinner: 'cards-theme-name-choose-winner',
    pass: 'cards-theme-name-pass',
  } as const;
  return withNestedPatterns('theme-name', 'theme-name', compiled.patterns, {
    actions: {
      [recipes.setTheme]: compiled.setTheme,
      [recipes.playName]: compiled.playName,
      [recipes.playSpecial]: compiled.playSpecial,
      [recipes.chooseWinner]: compiled.chooseWinner,
      [recipes.pass]: compiled.pass,
    },
    effects: compiled.effects,
    setup: compiled.setup,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const key = Object.entries(recipes).find(
          ([, recipe]) => recipe === selected.recipe,
        )?.[0];
        return mappedAction(
          availableActions,
          input.actionIds,
          key ?? null,
          selected.payload,
        );
      },
    },
  });
}

export function chapterEncounterPattern(input: {
  config: ChapterEncounterProgram;
  actionIds: ActionIds<'roll'>;
}) {
  const compiled = chapterEncounterRules(input.config);
  return definePattern<State>({
    id: `chapter-encounter:${input.config.trackId}`,
    mechanics: ['chapter-encounter'],
    actions: { 'choice-chapter-encounter-roll': compiled.roll },
    choices: compiled.choices,
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ availableActions }) =>
        mappedAction(availableActions, input.actionIds, 'roll'),
    },
  });
}

export function pawScoringPattern(input: {
  config: PawScoringProgram;
  actionIds: ActionIds<'draw' | 'play' | 'discard'>;
}) {
  const compiled = pawScoringRules(input.config);
  const recipes = {
    draw: 'paw-round-draw',
    play: 'paw-round-play',
    discard: 'paw-round-discard',
  } as const;
  return withNestedPatterns('paw-scoring', 'paw-scoring', compiled.patterns, {
    actions: {
      [recipes.draw]: compiled.draw,
      [recipes.play]: compiled.play,
      [recipes.discard]: compiled.discard,
    },
    effects: compiled.effects,
    components: compiled.components,
    config: compiled.config,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        const key = Object.entries(recipes).find(
          ([, recipe]) => recipe === selected.recipe,
        )?.[0];
        return mappedAction(
          availableActions,
          input.actionIds,
          key ?? null,
          selected.payload,
        );
      },
    },
  });
}

export function simultaneousQuizPattern(input: {
  config: SimultaneousQuizProgram;
}) {
  const compiled = simultaneousQuizRules(input.config);
  return withNestedPatterns(
    'simultaneous-quiz',
    'simultaneous-quiz',
    compiled.patterns,
    {
      actions: {
        'choice-simultaneous-quiz-draw': compiled.draw,
        'choice-simultaneous-quiz-answer': compiled.answer,
        'choice-simultaneous-quiz-timeout': compiled.timeout,
        'choice-simultaneous-quiz-ready': compiled.ready,
      },
      config: compiled.config,
      events: compiled.events,
      components: compiled.components,
      bot: {
        choose: ({ availableActions, ctx }) => {
          const selected = compiled.chooseBot(availableActions, ctx);
          if (!selected) return null;
          const type = selected.recipe.replace('choice-simultaneous-quiz-', '');
          return availableActions.includes(type)
            ? { type, payload: selected.payload }
            : null;
        },
      },
    },
  );
}

export function storyChallengePattern(input: {
  config: StoryChallengeProgram;
  actionIds: ActionIds<'roll' | 'draw'>;
}) {
  const compiled = storyChallengeRules(input.config);
  return withNestedPatterns(
    'story-challenge',
    'story-challenge',
    compiled.patterns,
    {
      actions: {
        'choice-story-challenge-roll': compiled.roll,
        'choice-story-challenge-draw': compiled.draw,
      },
      choices: compiled.choices,
      setup: compiled.setup,
      effects: compiled.effects,
      automatic: compiled.automatic,
      components: compiled.components,
      bot: {
        choose: ({ availableActions }) =>
          mappedAction(availableActions, input.actionIds, 'draw') ??
          mappedAction(availableActions, input.actionIds, 'roll'),
      },
    },
  );
}

export function directionalHazardPattern(input: {
  config: DirectionalHazardRaceProgram;
  actionIds: ActionIds<'roll'>;
}) {
  const compiled = directionalHazardRaceRules(input.config);
  return definePattern<State>({
    id: `directional-hazard:${input.config.trackId}`,
    mechanics: ['directional-hazard'],
    actions: { 'race-hazard-roll': compiled.roll },
    choices: compiled.choices,
    effects: compiled.effects,
    bot: {
      choose: ({ availableActions }) =>
        mappedAction(availableActions, input.actionIds, 'roll'),
    },
  });
}
