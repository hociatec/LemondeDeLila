import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonJudgedCardsSchema,
  assertJudgedCardsReferences,
} from '../../definitions/json-judged-cards-schema';
import { judgedCardsRules } from '../../recipes/gameplay/judged-cards.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'cards',
  documentKey: 'judgedCards',
  outputKey: 'judged',
  schema: jsonJudgedCardsSchema,
  compile: judgedCardsRules,
  ownsSetup: true,
  victoryKind: 'by-judged-cards',
  validate: (context, program) =>
    assertJudgedCardsReferences(
      program,
      context.document.components,
      context.document.phases,
      context.document.initialPhase,
      context.minimumPlayers,
    ),
  handlers: (context, compiled, program) => ({
    setup: compiled.setup,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const judging = ctx.phase.current() === program.judgingPhase;
        const recipe = judging ? 'judged-pick' : 'judged-submit-card';
        const type = context.actionFor(availableActions, [recipe]);
        if (!type) return null;
        if (judging) {
          const winnerId = compiled.chooseWinner(ctx);
          return winnerId == null ? null : { type, payload: { winnerId } };
        }
        const cardId = compiled.chooseCard(ctx, actor.id);
        return cardId == null ? null : { type, payload: { cardId } };
      },
    },
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'judged-submit-card': compiled.submit,
    'judged-pick': compiled.pick,
  }),
  patterns: (compiled) => [compiled.pattern],
});
