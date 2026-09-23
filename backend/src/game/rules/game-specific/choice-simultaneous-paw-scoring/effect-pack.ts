import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonPawScoringSchema,
  assertPawScoringReferences,
} from './json-paw-scoring-schema';
import { pawScoringRules } from './paw-scoring.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'choice',
  documentKey: 'pawScoring',
  outputKey: 'pawScoring',
  schema: jsonPawScoringSchema,
  compile: pawScoringRules,
  validateProgram: assertPawScoringReferences,
  victoryKind: 'by-paw-scoring',
  validate: (_context, program) => assertPawScoringReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: {},
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: context.selectedBot(({ actor, ctx }) =>
      compiled.chooseBot(actor.id, ctx),
    ),
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'paw-round-draw': compiled.draw,
    'paw-round-play': compiled.play,
    'paw-round-discard': compiled.discard,
  }),
  patterns: (compiled) => compiled.patterns,
});
