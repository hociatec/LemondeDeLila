import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonGridSchema,
  assertGridReferences,
} from '../../definitions/json-grid-schema';
import { gridPlacementRules } from '../../recipes/gameplay/grid-placement.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'spatial',
  documentKey: 'grid',
  outputKey: 'grid',
  schema: jsonGridSchema,
  compile: gridPlacementRules,
  choiceIds: (program) => [program.pawnSelection?.choiceId],
  victoryKind: 'by-grid',
  validate: (context, program) => {
    assertGridReferences(
      program,
      context.document.components,
      context.maximumPlayers,
      context.gameId,
    );
    if (program.pawnSelection && context.document.setup.startRound === false)
      context.fail(
        'setup.startRound',
        'grid pawn selection requires a starting round',
      );
  },
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const type = context.actionFor(availableActions, ['grid-place']);
        const payload = type ? compiled.choose(ctx, actor.id) : null;
        return type && payload ? { type, payload } : null;
      },
    },
  }),
  events: (compiled) => compiled.events,
  actions: (compiled) => ({
    'grid-place': compiled.play,
  }),
  patterns: (compiled) => [compiled.pattern],
});
