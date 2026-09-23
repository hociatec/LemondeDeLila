import { assertBoardPawnCapacity } from './json-board-pawn-capacity';
import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import { jsonBoardSchema, assertBoardReferences } from './json-board-schema';
import { boardTurnRules } from './board-turn.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
  domain: 'board',
  documentKey: 'board',
  outputKey: 'board',
  schema: jsonBoardSchema,
  compile: boardTurnRules,
  ownsSetup: true,
  choiceIds: (program) => [
    program.pawnSelection?.choiceId,
    program.directionChoiceId,
    program.quiz?.choiceId,
    program.exchange?.takeChoiceId,
    program.exchange?.giveChoiceId,
  ],
  victoryKind: 'by-board',
  validate: (context, program) => {
    if (
      context.document.setup.firstPlayer !== undefined ||
      context.document.setup.startRound !== undefined
    )
      context.fail('setup', 'board owns the starting player and round');
    assertBoardPawnCapacity(
      program,
      context.document,
      context.maximumPlayers,
      context.fail,
    );
    assertBoardReferences(
      program,
      context.components,
      context.document.phases,
      context.document.initialPhase,
    );
  },
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    automatic: compiled.automatic,
    bot: context.fallbackRecipeBot('board-draw'),
  }),
  actions: (compiled) => ({
    'board-roll': compiled.roll,
    'board-draw': compiled.draw,
  }),
});
