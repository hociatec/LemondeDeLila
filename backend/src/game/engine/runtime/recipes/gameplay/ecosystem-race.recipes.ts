import type {
  EcosystemFace,
  EcosystemRaceProgram,
} from '../../contracts/ecosystem-race-program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEvent } from '../../events/game-event-definition';
import { gameInput } from '../../actions/game-input-schema';
import { rollDice } from './card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;

export function ecosystemRaceRules(source: EcosystemRaceProgram) {
  const program = structuredClone(source);
  const resolved = defineEvent({
    type: program.resolvedEvent,
    data: gameInput.object({
      playerId: gameInput.playerId(),
      value: gameInput.number({ integer: true }),
      face: gameInput.enum(program.faces),
    }),
  });
  return {
    roll: rollDice<State>({
      diceId: program.diceId,
      policy: { reroll: { while: ({ total }) => total === 6, max: 1 } },
      execute: ({ playerId, total, ctx }) => {
        const face = program.faces[Math.max(0, Math.min(5, total - 1))];
        if (!face) return;
        applyFace(program, playerId, face, ctx);
        const position = ctx.movement.move(program.trackId, playerId, 1);
        applyTile(program, playerId, position, face, ctx);
        if (face === 'danger') applyDanger(program, position, ctx);
        resolved.emit(ctx, {
          playerId: gameInput.playerId().parse(playerId),
          value: total,
          face,
        });
        finishIfImpact(program, ctx);
        if (ctx.match.lifecycle() !== 'finished') ctx.turn.complete();
      },
    }),
    events: [resolved],
  };
}

function applyFace(
  program: EcosystemRaceProgram,
  playerId: number,
  face: EcosystemFace,
  ctx: Context,
): void {
  const resources = program.resources;
  if (face === 'danger') return;
  if (face === 'egg') {
    const resource =
      ctx.resources.get(playerId, resources.herbivores) >=
      ctx.resources.get(playerId, resources.carnivores)
        ? resources.herbivores
        : resources.carnivores;
    ctx.resources.add(playerId, resource, 1);
  } else {
    const resource =
      face === 'herbivore'
        ? resources.herbivores
        : face === 'carnivore'
          ? resources.carnivores
          : resources.leaves;
    ctx.resources.add(playerId, resource, 1);
  }
}

function applyTile(
  program: EcosystemRaceProgram,
  playerId: number,
  tile: number,
  face: EcosystemFace,
  ctx: Context,
): void {
  const r = program.resources;
  if (tile === 1 && (face === 'egg' || face === 'leaf')) {
    ctx.resources.add(playerId, face === 'egg' ? r.eggs : r.leaves, 1);
    ctx.events.message(`${program.eventNamespace}.harvest.doubled`, {
      playerId,
      face,
    });
  } else if (
    tile === 2 &&
    ctx.resources.get(playerId, r.carnivores) >
      ctx.resources.get(playerId, r.herbivores) &&
    ctx.resources.has(playerId, r.herbivores, 1)
  )
    ctx.resources.remove(playerId, r.herbivores, 1);
  else if (tile === 3 && face === 'leaf')
    ctx.resources.add(playerId, r.leaves, 1);
  else if (tile === 4 && face === 'carnivore')
    ctx.resources.add(playerId, r.eggs, 1);
  else if (tile === 6) ctx.counters.set(program.dangerCounter, 1);
  else if (tile === 7) ctx.resources.add(playerId, r.leaves, 1);
  else if (tile === 8 && (face === 'herbivore' || face === 'carnivore'))
    ctx.resources.add(playerId, r.leaves, 1);
}

function applyDanger(
  program: EcosystemRaceProgram,
  tile: number,
  ctx: Context,
): void {
  ctx.events.message(`${program.eventNamespace}.danger.triggered`, {
    tileId: tile,
  });
  const distance =
    1 +
    (ctx.counters.get(program.dangerCounter) > 0 ? 1 : 0) +
    (tile === 9 ? 1 : 0);
  for (const player of ctx.players.all())
    ctx.movement.move(program.trackId, player.id, distance);
  ctx.counters.set(program.dangerCounter, 0);
}

function finishIfImpact(program: EcosystemRaceProgram, ctx: Context): void {
  if (
    !ctx.players
      .all()
      .some(
        (player) =>
          ctx.movement.position(program.trackId, player.id) >=
          program.tiles.length - 1,
      )
  )
    return;
  const r = program.resources;
  const ranked = ctx.ranking.rank(
    ctx.players.all().map((player) => player.id),
    {
      value: (id) =>
        ctx.resources.get(id, r.herbivores) +
        ctx.resources.get(id, r.carnivores) +
        ctx.resources.get(id, r.leaves),
      direction: 'desc',
    },
    { value: (id) => ctx.resources.get(id, r.leaves), direction: 'desc' },
    { value: (id) => ctx.resources.get(id, r.eggs), direction: 'desc' },
  );
  const winnerId = ranked[0]?.playerId;
  if (winnerId != null)
    ctx.match.finish({ winners: [winnerId], reason: program.finishReason });
}
