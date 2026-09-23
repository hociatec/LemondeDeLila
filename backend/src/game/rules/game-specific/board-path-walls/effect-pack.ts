import { defineJsonEffectPack } from '../../../engine/runtime/contracts/json-effect-pack';
import {
  jsonPathWallsSchema,
  assertPathWallsReferences,
} from './json-path-walls-schema';
import { pathWallsRules } from './path-walls.recipes';

export const effectPack = defineJsonEffectPack({
  scope: 'game-specific',
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
        const turn = compiled.botTurn(actor.id, ctx);
        if (!turn) return null;
        const type = context.actionFor(availableActions, [
          turn.kind === 'wall'
            ? 'board-path-walls-place-wall'
            : 'board-path-walls-move',
        ]);
        return type ? { type, payload: turn.payload } : null;
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
