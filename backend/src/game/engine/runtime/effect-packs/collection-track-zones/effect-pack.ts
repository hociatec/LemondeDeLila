import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonTrackZoneCollectionSchema,
  assertTrackZoneCollectionReferences,
} from '../../definitions/json-track-zone-collection-schema';
import { trackZoneCollectionRules } from './track-zone-collection.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'collection',
  documentKey: 'trackZoneCollection',
  outputKey: 'trackZoneCollection',
  schema: jsonTrackZoneCollectionSchema,
  compile: trackZoneCollectionRules,
  victoryKind: 'by-track-zone-collection',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'track-zone collection requires its declared race track',
      );
    assertTrackZoneCollectionReferences(
      program,
      context.components,
      context.resources,
    );
  },
  handlers: (context) => ({
    bot: context.recipeBot('collection-track-zones-roll'),
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'collection-track-zones-roll': compiled.roll,
  }),
});
