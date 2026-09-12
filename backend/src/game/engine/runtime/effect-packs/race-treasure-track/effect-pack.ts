import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonTreasureTrackRaceSchema,
  assertTreasureTrackRaceReferences,
} from '../../definitions/json-treasure-track-race-schema';
import { treasureTrackRaceRules } from './treasure-track-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'treasureTrackRace',
  outputKey: 'treasureTrackRace',
  schema: jsonTreasureTrackRaceSchema,
  compile: treasureTrackRaceRules,
  victoryKind: 'by-treasure-track-race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId))
      context.fail(
        'patterns',
        'treasure track race requires its declared race track',
      );
    assertTreasureTrackRaceReferences(
      program,
      context.components,
      context.resources,
    );
  },
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    bot: context.recipeBot('race-treasure-track-roll'),
  }),
  actions: (compiled) => ({
    'race-treasure-track-roll': compiled.roll,
  }),
});
