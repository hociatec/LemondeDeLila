import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonBalloonRaceSchema,
  assertBalloonRaceReferences,
} from '../../definitions/json-balloon-race-schema';
import { balloonRaceRules } from './balloon-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'balloonRace',
  outputKey: 'balloonRace',
  schema: jsonBalloonRaceSchema,
  compile: balloonRaceRules,
  validate: (context, program) =>
    assertBalloonRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: {
      choose: ({ availableActions }) => {
        const type =
          context.actionFor(availableActions, ['balloon-race-draw']) ??
          context.actionFor(availableActions, ['balloon-race-roll']);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'balloon-race-roll': compiled.roll,
    'balloon-race-draw': compiled.draw,
  }),
});
