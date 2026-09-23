import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonAnonymousVoteSchema,
  assertAnonymousVoteReferences,
} from './json-anonymous-vote-schema';
import { anonymousVoteRules } from './anonymous-vote.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
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
    bot: context.selectedBot(({ actor, ctx }) =>
      compiled.chooseBot(actor.id, ctx),
    ),
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'choice-anonymous-vote-choose': compiled.choose,
    'choice-anonymous-vote-vote': compiled.vote,
  }),
});
