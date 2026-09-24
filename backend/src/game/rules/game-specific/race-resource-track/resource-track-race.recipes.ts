import {
  defineEvent,
  gameInput,
  rollDice,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { ResourceTrackRaceProgram } from './program';
import { resourceDeltaEffects } from '../../recipes/resource-deltas';

type State = Record<string, never>;
type Context = GameContext<State>;

export function resourceTrackRaceRules(source: ResourceTrackRaceProgram) {
  const program = structuredClone(source);
  const rules = program.mechanics;
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
      policy: {
        reroll: {
          while: ({ total }) => rules.rerollValues.includes(total),
          max: rules.rerollLimit,
        },
      },
      execute: ({ playerId, total, ctx }) => {
        const face =
          program.faces[
            Math.max(0, Math.min(program.faces.length - 1, total - 1))
          ];
        if (!face) return;
        for (const gain of rules.faceGains[face]) {
          const resource =
            gain.select === 'largest'
              ? gain.resources.reduce((best, next) =>
                  ctx.resources.get(playerId, next) >
                  ctx.resources.get(playerId, best)
                    ? next
                    : best,
                )
              : gain.resources[0];
          ctx.resources.add(playerId, resource, gain.amount);
        }
        const position = ctx.movement.move(
          program.trackId,
          playerId,
          rules.advance,
        );
        for (const rule of rules.tileRules) {
          if (
            rule.position !== position ||
            (rule.faces && !rule.faces.includes(face))
          )
            continue;
          const comparison = rule.greaterResource;
          if (
            comparison &&
            ctx.resources.get(playerId, comparison.left) <=
              ctx.resources.get(playerId, comparison.right)
          )
            continue;
          const gains = Object.fromEntries(
            Object.entries(rule.gains).filter(([, delta]) => delta !== 0),
          );
          ctx.effects.run(
            ...resourceDeltaEffects(gains, { kind: 'player', playerId }),
          );
          if (rule.setCounter)
            ctx.counters.set(rule.setCounter.id, rule.setCounter.value);
          if (rule.event) ctx.events.message(rule.event, { playerId, face });
        }
        if (rules.dangerFaces.includes(face)) {
          ctx.events.message(program.eventNamespace + '.danger.triggered', {
            tileId: position,
          });
          const distance =
            rules.dangerDistance +
            (ctx.counters.get(program.dangerCounter) > 0
              ? rules.amplifiedDistance
              : 0) +
            (rules.extraDistance[String(position)] ?? 0);
          for (const player of ctx.players.all())
            ctx.movement.move(program.trackId, player.id, distance);
          ctx.counters.set(program.dangerCounter, 0);
        }
        resolved.emit(ctx, {
          playerId: gameInput.playerId().parse(playerId),
          value: total,
          face,
        });
        finishAtEnd(program, ctx);
        if (ctx.match.lifecycle() !== 'finished') ctx.turn.complete();
      },
    }),
    events: [resolved],
  };
}
function finishAtEnd(program: ResourceTrackRaceProgram, ctx: Context) {
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
  const ranked = ctx.ranking.rank(
    ctx.players.all().map((player) => player.id),
    ...program.mechanics.ranking.map((resources) => ({
      value: (id: number) =>
        resources.reduce(
          (sum, resource) => sum + ctx.resources.get(id, resource),
          0,
        ),
      direction: 'desc' as const,
    })),
  );
  const winnerId = ranked[0]?.playerId;
  if (winnerId != null)
    ctx.match.finish({ winners: [winnerId], reason: program.finishReason });
}
