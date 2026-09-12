import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonCollectionRaceSchema,
  assertCollectionRaceReferences,
} from '../../definitions/json-collection-race-schema';
import { collectionRaceRules } from './collection-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'collectionRace',
  outputKey: 'collectionRace',
  schema: jsonCollectionRaceSchema,
  compile: collectionRaceRules,
  victoryKind: 'by-collection-race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'collection race requires its declared race track',
      );
    assertCollectionRaceReferences(
      program,
      context.components,
      context.resources,
    );
  },
  handlers: (context) => ({
    bot: context.recipeBot('collection-race-roll'),
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'collection-race-roll': compiled.roll,
  }),
});
