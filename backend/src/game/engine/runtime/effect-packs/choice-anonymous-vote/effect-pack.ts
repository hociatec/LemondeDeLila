import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonAnonymousVoteSchema,
  assertAnonymousVoteReferences,
} from '../../definitions/json-anonymous-vote-schema';
import { anonymousVoteRules } from './anonymous-vote.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'choice',
  documentKey: 'anonymousVote',
  outputKey: 'anonymousVote',
  schema: jsonAnonymousVoteSchema,
  compile: anonymousVoteRules,
  victoryKind: 'by-anonymous-vote',
  validate: (_context, program) => assertAnonymousVoteReferences(program),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    viewExtension: compiled.viewExtension,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = compiled.chooseBot(actor.id, ctx);
        if (!selected) return null;
        const type = context.actionFor(availableActions, [selected.recipe]);
        return type ? { type, payload: selected.payload } : null;
      },
    },
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'choice-anonymous-vote-choose': compiled.choose,
    'choice-anonymous-vote-vote': compiled.vote,
  }),
});
