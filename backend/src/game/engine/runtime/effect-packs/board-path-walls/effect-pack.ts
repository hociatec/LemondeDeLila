import { defineJsonEffectPack } from '../../contracts/json-effect-pack';
import {
  jsonPathWallsSchema,
  assertPathWallsReferences,
} from '../../definitions/json-path-walls-schema';
import { pathWallsRules } from './path-walls.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'generic',
  domain: 'board',
  documentKey: 'pathWalls',
  outputKey: 'pathWalls',
  schema: jsonPathWallsSchema,
  compile: pathWallsRules,
  victoryKind: 'by-path-walls',
  validate: (_context, program) => assertPathWallsReferences(program),
  handlers: (context, compiled) => ({
    config: compiled.config,
    choices: compiled.choices,
    initialization: compiled.initialization,
    bot: {
      choose: ({ actor, availableActions, ctx }) => {
        const type = context.actionFor(availableActions, [
          'board-path-walls-move',
        ]);
        const move = compiled.firstMove(actor.id, ctx);
        return type && move ? { type, payload: move } : null;
      },
    },
  }),
  components: (compiled) => compiled.components,
  actions: (compiled) => ({
    'board-path-walls-move': compiled.move,
    'board-path-walls-place-wall': compiled.placeWall,
  }),
  patterns: (compiled) => compiled.patterns,
});
