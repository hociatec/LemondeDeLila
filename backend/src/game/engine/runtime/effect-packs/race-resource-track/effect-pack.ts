import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonResourceTrackRaceSchema,
  assertResourceTrackRaceReferences,
} from '../../definitions/json-resource-track-race-schema';
import { resourceTrackRaceRules } from './resource-track-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'resourceTrackRace',
  outputKey: 'resourceTrackRace',
  schema: jsonResourceTrackRaceSchema,
  compile: resourceTrackRaceRules,
  victoryKind: 'by-resource-track-race',
  victoryLabel: 'resource track race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'resource track race requires its declared race track',
      );
    assertResourceTrackRaceReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    );
  },
  handlers: (context) => ({
    bot: context.recipeBot('race-resource-track-roll'),
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'race-resource-track-roll': compiled.roll,
  }),
});
