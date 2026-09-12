import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonEcosystemRaceSchema,
  assertEcosystemRaceReferences,
} from '../../definitions/json-ecosystem-race-schema';
import { ecosystemRaceRules } from './ecosystem-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'ecosystemRace',
  outputKey: 'ecosystemRace',
  schema: jsonEcosystemRaceSchema,
  compile: ecosystemRaceRules,
  victoryKind: 'by-ecosystem-race',
  victoryLabel: 'ecosystem race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'ecosystem race requires its declared race track',
      );
    assertEcosystemRaceReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    );
  },
  handlers: (context) => ({
    bot: context.recipeBot('ecosystem-race-roll'),
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'ecosystem-race-roll': compiled.roll,
  }),
});
