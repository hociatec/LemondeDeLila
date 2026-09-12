import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import type { GameState } from '../../../core/application/models/game-state.model';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

it.each(
  discoverGameDefinitions().map(
    (definition) => [definition.id, definition] as const,
  ),
)(
  '%s keeps private kit state out of other player views',
  async (_id, definition) => {
    const count = Math.max(
      definition.players.min,
      Math.min(3, definition.players.max),
    );
    const game = await testGame(definition)
      .players(
        Array.from({ length: count }, (_, index) => ({
          username: `Player${index + 1}`,
          isBot: true,
        })),
      )
      .seed(11)
      .start();
    const state = game.state();
    const before = structuredClone(state);
    const runtime = new DeclarativeGameRuntime(definition);
    const playerIds = (state.players ?? []).map((player) => player.id);
    const views = new Map<number | null, RecordValue>([
      [null, record(runtime.exposeStateForUser(state, null))],
      ...playerIds.map(
        (playerId) =>
          [
            playerId,
            record(runtime.exposeStateForUser(state, playerId)),
          ] as const,
      ),
    ]);

    for (const view of views.values()) {
      expect(view).not.toHaveProperty('engine');
      expect(view).not.toHaveProperty('metadata');
      expect(view).not.toHaveProperty('log');
    }
    assertPrivateCards(definition.components ?? [], state, views);
    assertPrivateInventory(definition.components ?? [], state, views);
    assertPrivateOwnership(definition.components ?? [], state, views);

    const spectatorKits = record(views.get(null)?.kits);
    spectatorKits.projectionMutation = { nested: true };
    expect(state).toEqual(before);
  },
);

function assertPrivateCards(
  components: readonly { component: string; id: string }[],
  state: GameState,
  views: ReadonlyMap<number | null, RecordValue>,
): void {
  const engine = record(record(state).engine);
  const internalCards = record(record(engine.kits).cards);
  const hands = record(internalCards.hands);
  for (const component of components) {
    if (component.component === 'cards.hands') {
      const definition = component as typeof component & {
        visibility?: string;
      };
      if ((definition.visibility ?? 'owner') !== 'owner') continue;
      for (const [playerId, cards] of Object.entries(
        record(hands[component.id]),
      )) {
        for (const [viewerId, view] of views) {
          if (viewerId === Number(playerId)) continue;
          const projected = record(
            record(record(record(view.kits).cards).hands)[component.id],
          );
          expect(record(projected.byPlayer)[playerId]).toEqual({
            count: array(cards).length,
          });
        }
      }
    }
    if (component.component === 'cards.zone') {
      const definition = component as typeof component & {
        visibility?: string;
      };
      if ((definition.visibility ?? 'hidden') === 'public') continue;
      const count = array(record(internalCards.zones)[component.id]).length;
      for (const view of views.values()) {
        const projected = record(
          record(record(record(view.kits).cards).zones)[component.id],
        );
        expect(projected.cards).toEqual({ count });
      }
    }
  }
}

function assertPrivateInventory(
  components: readonly { component: string; id: string }[],
  state: GameState,
  views: ReadonlyMap<number | null, RecordValue>,
): void {
  const inventories = record(
    record(record(record(state).engine).kits).inventory,
  );
  const byInventory = record(inventories.byPlayer);
  for (const component of components) {
    const definition = component as typeof component & {
      visibility?: string;
    };
    if (
      component.component !== 'inventory.set' ||
      definition.visibility !== 'owner'
    )
      continue;
    for (const [playerId, items] of Object.entries(
      record(byInventory[component.id]),
    )) {
      for (const [viewerId, view] of views) {
        if (viewerId === Number(playerId)) continue;
        const projected = record(
          record(record(view.kits).inventory)[component.id],
        );
        expect(record(projected.byPlayer)[playerId]).toEqual({
          count: array(items).length,
        });
      }
    }
  }
}

function assertPrivateOwnership(
  components: readonly { component: string; id: string }[],
  state: GameState,
  views: ReadonlyMap<number | null, RecordValue>,
): void {
  const ownership = record(record(record(record(state).engine).kits).ownership);
  const registries = record(ownership.owners);
  for (const component of components) {
    const definition = component as typeof component & {
      visibility?: string;
    };
    if (
      component.component !== 'ownership.registry' ||
      definition.visibility !== 'owner'
    )
      continue;
    for (const [assetId, ownersValue] of Object.entries(
      record(registries[component.id]),
    )) {
      const ownerIds = array(ownersValue).map(Number);
      for (const [viewerId, view] of views) {
        if (viewerId != null && ownerIds.includes(viewerId)) continue;
        const projected = record(
          record(record(view.kits).ownership)[component.id],
        );
        expect(record(projected.owners)).not.toHaveProperty(assetId);
      }
    }
  }
}
