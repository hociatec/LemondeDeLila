import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonEventRaceSchema,
  assertEventRaceReferences,
} from '../../definitions/json-event-race-schema';
import { eventRaceRules } from '../../recipes/gameplay/event-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
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
    bot: context.recipeBot('race-event-cards-roll'),
  }),
  actions: (compiled) => ({
    'race-event-cards-roll': compiled.roll,
  }),
});
