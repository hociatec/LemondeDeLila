import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonBoardSchema,
  assertBoardReferences,
} from '../../definitions/json-board-schema';
import { boardTurnRules } from '../../recipes/gameplay/board-turn.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
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
    bot: context.boardBot(),
  }),
  actions: (compiled) => ({
    'board-roll': compiled.roll,
    'board-draw': compiled.draw,
  }),
});
