import { defineJsonProgramExtension } from '../../contracts/json-program-extension';
import {
  jsonEventRaceSchema,
  assertEventRaceReferences,
} from '../../definitions/json-event-race-schema';
import { eventRaceRules } from '../../recipes/gameplay/event-race.recipes';

export const extension = defineJsonProgramExtension({
  documentKey: 'eventRace',
  outputKey: 'eventRace',
  schema: jsonEventRaceSchema,
  compile: eventRaceRules,
  ownsSetup: true,
  choiceIds: (program) => [program.pawnSelection.choiceId],
  victoryKind: 'by-event-race',
  validate: (context, program) => {
    if (!context.hasRaceTrack(program.trackId, true))
      context.fail(
        'patterns',
        'event race requires a race with finish victory',
      );
    assertEventRaceReferences(
      program,
      context.components,
      context.document.phases,
      context.document.initialPhase,
      context.maximumPlayers,
    );
  },
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    bot: context.recipeBot('event-race-roll'),
  }),
  actions: (compiled) => ({
    'event-race-roll': compiled.roll,
  }),
});
