import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonTreasureTrackRaceSchema,
  assertTreasureTrackRaceReferences,
} from './json-treasure-track-race-schema';
import { treasureTrackRaceRules } from './treasure-track-race.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'effects'],
  scope: 'game-specific',
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
