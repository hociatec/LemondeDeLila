import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonChainedTileRaceSchema,
  assertChainedTileRaceReferences,
} from '../../definitions/json-chained-tile-race-schema';
import { chainedTileRaceRules } from './chained-tile-race.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'race',
  documentKey: 'chainedTileRace',
  outputKey: 'chainedTileRace',
  schema: jsonChainedTileRaceSchema,
  compile: chainedTileRaceRules,
  validate: (context, program) =>
    assertChainedTileRaceReferences(program, context.components),
  handlers: (context, compiled) => ({
    setup: compiled.setup,
    choices: compiled.choices,
    effects: compiled.effects,
    playerValuesVisibility: context.publicStatuses(),
    bot: {
      choose: ({ availableActions }) => {
        const type =
          context.actionFor(availableActions, [
            'race-chained-tile-cards-draw',
          ]) ??
          context.actionFor(availableActions, ['race-chained-tile-cards-roll']);
        return type ? { type, payload: {} } : null;
      },
    },
  }),
  actions: (compiled) => ({
    'race-chained-tile-cards-roll': compiled.roll,
    'race-chained-tile-cards-draw': compiled.draw,
  }),
});
