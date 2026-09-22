import type { ResourceTrackRaceProgram } from '../effect-packs/race-resource-track/program';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
} from '../../engine/runtime/contracts/json-author-schema';
import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';

export const jsonResourceTrackRaceSchema = object({
  trackId: id,
  diceId: id,
  tiles: array(
    object({
      n: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: id,
    }),
    2,
  ),
  faces: array(id, 2),
  resources: record(id),
  mechanics: object({
    rerollValues: array({ type: 'integer', minimum: 1 }),
    rerollLimit: { type: 'integer', minimum: 0, maximum: 100 },
    advance: { type: 'integer', minimum: 1 },
    faceGains: record(
      array(
        object({
          resources: array(id, 1),
          amount: { type: 'integer', minimum: 0 },
          select: { enum: ['first', 'largest'] },
        }),
      ),
    ),
    tileRules: array(
      object(
        {
          position: { type: 'integer', minimum: 0 },
          faces: array(id, 1),
          greaterResource: object({ left: id, right: id }),
          gains: record({ type: 'integer' }),
          setCounter: object({ id, value: { type: 'integer', minimum: 0 } }),
          event: id,
        },
        ['position', 'gains'],
      ),
    ),
    dangerFaces: array(id),
    dangerDistance: { type: 'integer', minimum: 0 },
    amplifiedDistance: { type: 'integer', minimum: 0 },
    extraDistance: record({ type: 'integer', minimum: 0 }),
    ranking: array(array(id, 1), 1),
  }),
  dangerCounter: id,
  finishReason: id,
  resolvedEvent: id,
  eventNamespace: id,
});

export function assertResourceTrackRaceReferences(
  program: ResourceTrackRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Resource track race: ' + reason);
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
  const rules = program.mechanics;
  const checkResource = (key: string) => {
    if (!resources.has(key)) fail('unknown resource ' + key);
  };
  const checkFace = (face: string) => {
    if (!program.faces.includes(face)) fail('unknown face ' + face);
  };
  for (const face of program.faces)
    if (!Object.hasOwn(rules.faceGains, face)) fail('missing face gains');
  for (const [face, gains] of Object.entries(rules.faceGains)) {
    checkFace(face);
    for (const gain of gains) gain.resources.forEach(checkResource);
  }
  rules.dangerFaces.forEach(checkFace);
  if (rules.rerollValues.some((value) => value > program.faces.length))
    fail('unknown reroll face');
  for (const rule of rules.tileRules) {
    if (rule.position >= program.tiles.length) fail('unknown rule position');
    rule.faces?.forEach(checkFace);
    Object.keys(rule.gains).forEach(checkResource);
    if (rule.greaterResource) {
      checkResource(rule.greaterResource.left);
      checkResource(rule.greaterResource.right);
    }
    if (rule.setCounter && !counters.has(rule.setCounter.id))
      fail('unknown rule counter');
  }
  for (const key of Object.keys(rules.extraDistance))
    if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= program.tiles.length)
      fail('unknown distance position');
  for (const group of rules.ranking) group.forEach(checkResource);
}
