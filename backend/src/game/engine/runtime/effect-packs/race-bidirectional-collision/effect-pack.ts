import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonBidirectionalCollisionRaceSchema,
  assertBidirectionalCollisionRaceReferences,
} from '../../definitions/json-bidirectional-collision-race-schema';
import { bidirectionalCollisionRaceRules } from './bidirectional-collision-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'bidirectionalCollisionRace',
  outputKey: 'bidirectionalCollisionRace',
  schema: jsonBidirectionalCollisionRaceSchema,
  compile: bidirectionalCollisionRaceRules,
  victoryKind: 'by-bidirectional-collision-race',
  validate: (context, program) =>
    assertBidirectionalCollisionRaceReferences(
      program,
      context.components,
      context.resources,
    ),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('race-bidirectional-collision-roll'),
  }),
  actions: (compiled) => ({
    'race-bidirectional-collision-roll': compiled.roll,
  }),
});
