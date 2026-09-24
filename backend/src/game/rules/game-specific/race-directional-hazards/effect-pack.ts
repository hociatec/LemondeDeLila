import { defineJsonEffectPack } from '../../../engine/sdk/extension-api';
import {
  jsonDirectionalHazardRaceSchema,
  assertDirectionalHazardRaceReferences,
} from './json-directional-hazard-race-schema';
import { directionalHazardRaceRules } from './directional-hazard-race.recipes';

export const effectPack = defineJsonEffectPack({
  capabilities: ['actions', 'bot', 'choices', 'effects'],
  scope: 'game-specific',
  domain: 'race',
  documentKey: 'directionalHazardRace',
  outputKey: 'directionalHazardRace',
  schema: jsonDirectionalHazardRaceSchema,
  compile: directionalHazardRaceRules,
  victoryKind: 'by-directional-hazard-race',
  victoryRequired: false,
  validate: (context, program) => {
    const external = program.victoryMode === 'external';
    if (
      external ===
      (context.document.victory.kind === 'by-directional-hazard-race')
    )
      context.fail(
        'victory.kind',
        external
          ? 'external hazard victory requires an independent objective'
          : 'arrival hazard victory requires by-directional-hazard-race',
      );
    assertDirectionalHazardRaceReferences(
      program,
      context.components,
      context.resources,
      context.counters,
    );
  },
  handlers: (context, compiled) => ({
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('race-hazard-roll'),
  }),
  actions: (compiled) => ({
    'race-hazard-roll': compiled.roll,
  }),
});
