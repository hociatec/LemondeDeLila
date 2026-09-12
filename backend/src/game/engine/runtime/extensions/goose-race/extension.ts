import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonGooseRaceSchema,
  assertGooseRaceReferences,
} from '../../definitions/json-goose-race-schema';
import { gooseRaceRules } from '../../recipes/gameplay/goose-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'gooseRace',
  outputKey: 'gooseRace',
  schema: jsonGooseRaceSchema,
  compile: gooseRaceRules,
  victoryKind: 'by-goose-race',
  victoryLabel: 'goose race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail('patterns', 'goose race requires its declared race track');
    assertGooseRaceReferences(
      program,
      context.components,
      context.document.phases,
      context.maximumPlayers,
    );
  },
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: context.recipeBot('goose-race-roll'),
  }),
  actions: (compiled) => ({
    'goose-race-roll': compiled.roll,
  }),
});
