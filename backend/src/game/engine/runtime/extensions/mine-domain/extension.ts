import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonMineDomainSchema,
  assertMineDomainReferences,
} from '../../definitions/json-mine-domain-schema';
import { mineDomainRules } from './mine-domain.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'mineDomain',
  outputKey: 'mineDomain',
  schema: jsonMineDomainSchema,
  compile: mineDomainRules,
  victoryKind: 'by-mine-domain',
  validate: (context, program) =>
    assertMineDomainReferences(program, context.components),
  handlers: (context, compiled) => ({
    effects: compiled.effects,
    lifecycle: compiled.lifecycle,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const play = compiled.enumerate(actor.id, ctx)[0];
        const recipe = play ? 'mine-domain-play' : 'mine-domain-pass';
        const type = context.actionFor(availableActions, [recipe]);
        return type ? { type, payload: play ?? {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'mine-domain-play': compiled.play,
    'mine-domain-pass': compiled.pass,
  }),
});
