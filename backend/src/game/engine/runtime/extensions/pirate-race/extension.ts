import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonPirateRaceSchema,
  assertPirateRaceReferences,
} from '../../definitions/json-pirate-race-schema';
import { pirateRaceRules } from './pirate-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'pirateRace',
  outputKey: 'pirateRace',
  schema: jsonPirateRaceSchema,
  compile: pirateRaceRules,
  victoryKind: 'by-pirate-race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail('patterns', 'pirate race requires its declared race track');
    assertPirateRaceReferences(program, context.components, context.resources);
  },
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: context.recipeBot('pirate-race-roll'),
  }),
  actions: (compiled) => ({
    'pirate-race-roll': compiled.roll,
  }),
});
