import type { EcosystemRaceProgram } from '../extensions/ecosystem-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

export const jsonEcosystemRaceSchema = object({
  trackId: id,
  diceId: id,
  tiles: array(
    object({
      n: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: { const: 'comet' },
    }),
    2,
  ),
  faces: array(
    { enum: ['herbivore', 'carnivore', 'egg', 'leaf', 'danger'] },
    2,
  ),
  resources: object({
    herbivores: id,
    carnivores: id,
    eggs: id,
    leaves: id,
  }),
  dangerCounter: id,
  finishReason: id,
  resolvedEvent: id,
  eventNamespace: id,
});

export function assertEcosystemRaceReferences(
  program: EcosystemRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Ecosystem race: ' + reason);
  };
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  const dice = components.find(
    (component) =>
      component.component === 'dice.set' && component.id === program.diceId,
  );
  if (dice?.component !== 'dice.set' || dice.sides !== program.faces.length)
    fail('one face per dice side required');
  for (const resource of Object.values(program.resources))
    if (!resources.has(resource)) fail('unknown resource');
  if (!counters.has(program.dangerCounter)) fail('unknown danger counter');
}
