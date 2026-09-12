import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonPawScoringSchema,
  assertPawScoringReferences,
} from '../../definitions/json-paw-scoring-schema';
import { pawScoringRules } from './paw-scoring.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'choice',
  documentKey: 'pawScoring',
  outputKey: 'pawScoring',
  schema: jsonPawScoringSchema,
  compile: pawScoringRules,
  victoryKind: 'by-paw-scoring',
  validate: (_context, program) => assertPawScoringReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: {},
    lifecycle: compiled.lifecycle,
    effects: compiled.effects,
    playerValuesVisibility: compiled.playerValuesVisibility,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'paw-round-draw': compiled.draw,
    'paw-round-play': compiled.play,
    'paw-round-discard': compiled.discard,
  }),
  patterns: (compiled) => compiled.patterns,
});
