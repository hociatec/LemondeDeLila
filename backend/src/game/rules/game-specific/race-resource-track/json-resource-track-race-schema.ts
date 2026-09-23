import {
  authoringFailure,
  authoringProperty,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { ResourceTrackRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
} from '../../../engine/runtime/contracts/json-author-schema';

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
  const fail = authoringFailure(
    'game.json.resourceTrackRace',
    program,
    'Resource track race: ',
  );
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  const dice = components.find(
    (component) =>
      component.component === 'dice.set' && component.id === program.diceId,
  );
  if (dice?.component !== 'dice.set' || dice.sides !== program.faces.length)
    fail('diceId', 'one face per dice side required');
  for (const [key, resource] of Object.entries(program.resources))
    if (!resources.has(resource))
      fail(authoringProperty('resources', key), 'unknown resource');
  if (!counters.has(program.dangerCounter))
    fail('dangerCounter', 'unknown danger counter');
  const rules = program.mechanics;
  const checkResource = (key: string, path: string) => {
    if (!resources.has(key)) fail(path, 'unknown resource ' + key);
  };
  const checkFace = (face: string, path: string) => {
    if (!program.faces.includes(face)) fail(path, 'unknown face ' + face);
  };
  for (const face of program.faces)
    if (!Object.hasOwn(rules.faceGains, face))
      fail(
        authoringProperty('mechanics.faceGains', face),
        'missing face gains',
      );
  for (const [face, gains] of Object.entries(rules.faceGains)) {
    const path = authoringProperty('mechanics.faceGains', face);
    checkFace(face, path);
    gains.forEach((gain, i) =>
      gain.resources.forEach((resource, j) =>
        checkResource(resource, `${path}[${i}].resources[${j}]`),
      ),
    );
  }
  rules.dangerFaces.forEach((face, i) =>
    checkFace(face, `mechanics.dangerFaces[${i}]`),
  );
  rules.rerollValues.forEach((value, i) => {
    if (value > program.faces.length)
      fail(`mechanics.rerollValues[${i}]`, 'unknown reroll face');
  });
  for (const [i, rule] of rules.tileRules.entries()) {
    const path = `mechanics.tileRules[${i}]`;
    if (rule.position >= program.tiles.length)
      fail(`${path}.position`, 'unknown rule position');
    rule.faces?.forEach((face, j) => checkFace(face, `${path}.faces[${j}]`));
    Object.keys(rule.gains).forEach((key) =>
      checkResource(key, authoringProperty(`${path}.gains`, key)),
    );
    if (rule.greaterResource) {
      checkResource(rule.greaterResource.left, `${path}.greaterResource.left`);
      checkResource(
        rule.greaterResource.right,
        `${path}.greaterResource.right`,
      );
    }
    if (rule.setCounter && !counters.has(rule.setCounter.id))
      fail(`${path}.setCounter.id`, 'unknown rule counter');
  }
  for (const key of Object.keys(rules.extraDistance))
    if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= program.tiles.length)
      fail(
        authoringProperty('mechanics.extraDistance', key),
        'unknown distance position',
      );
  rules.ranking.forEach((group, i) =>
    group.forEach((key, j) =>
      checkResource(key, `mechanics.ranking[${i}][${j}]`),
    ),
  );
}
