import {
  createInventoryKitState,
  GameInventoryController,
  inventory,
} from '../../../engine/runtime/kits/inventory-kit';
import {
  createOwnershipKitState,
  GameOwnershipController,
  ownership,
} from '../../../engine/runtime/kits/ownership-kit';
import {
  createGridKitState,
  GameGridController,
  grid,
} from '../../../engine/runtime/kits/grid-kit';
import {
  createCardsKitState,
  GameCardsController,
  cards,
} from '../../../engine/runtime/cards/cards-kit';

it.each(Array.from({ length: 16 }, (_, i) => i + 1))(
  'conserves independent ownership, inventory, cards and grid models (seed=%i)',
  (seed) => {
    let random = seed;
    const pick = (maximum: number) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random % maximum;
    };
    const items = Array.from({ length: 3 + pick(7) }, (_, i) => `item${i}`);
    const players = [1, 2, -3];
    const bagState = createInventoryKitState();
    const bagDefinition = inventory.set({ id: 'bag', items });
    const bag = new GameInventoryController(bagState, {
      shuffle: (values) => [...values],
    });
    bag.create(bagDefinition, players);
    const ownerState = createOwnershipKitState();
    const ownerDefinition = ownership.registry({ id: 'assets', assets: items });
    const owners = new GameOwnershipController(ownerState);
    owners.create(ownerDefinition);
    const cardState = createCardsKitState();
    const deck = cards.deck({ id: 'deck', cards: items });
    const hands = cards.hands({
      id: 'hands',
      deck: 'deck',
      initial: 0,
      visibility: 'owner',
    });
    const rng = {
      pick: <T>(values: readonly T[]) => values[0] ?? null,
      shuffle: <T>(values: readonly T[]) => [...values],
    };
    const card = new GameCardsController(cardState, rng, undefined, [
      deck,
      hands,
    ]);
    card.createDeck(deck);
    card.createHands(hands, players);
    const model = new Map(items.map((item) => [item, 1]));
    for (const item of items) {
      bag.add('bag', 1, item);
      owners.claim('assets', item, 1);
      card.drawToHand('deck', 'hands', 1);
    }
    const width = 1 + pick(6),
      height = 1 + pick(6);
    const gridDefinition = grid.board({ id: 'board', width, height });
    const gridState = createGridKitState<string>();
    const board = new GameGridController(gridState);
    board.create(gridDefinition);
    const cells = new Map<string, string>();
    for (let step = 0; step < 60; step++) {
      const item = items[pick(items.length)];
      const from = model.get(item)!;
      const to = players[pick(players.length)];
      if (from !== to) {
        bag.transfer('bag', from, to, item);
        owners.transfer('assets', item, from, to);
        card.transfer('hands', from, to, item);
        model.set(item, to);
      }
      if (step % 3 === 0) {
        const other = items[pick(items.length)];
        const otherOwner = model.get(other)!;
        if (other !== item && otherOwner !== to) {
          bag.exchange('bag', to, item, otherOwner, other);
          card.exchange('hands', to, item, otherOwner, other);
          owners.transfer('assets', item, to, otherOwner);
          owners.transfer('assets', other, otherOwner, to);
          model.set(item, otherOwner);
          model.set(other, to);
        }
      }
      const position = { x: pick(width), y: pick(height) },
        key = `${position.x},${position.y}`;
      if (pick(3) === 0) {
        board.clear('board', position);
        cells.delete(key);
      } else {
        board.set('board', position, item);
        cells.set(key, item);
      }
      for (const player of players) {
        const expected = items
          .filter((value) => model.get(value) === player)
          .sort();
        expect(bag.items('bag', player).sort()).toEqual(expected);
        expect(card.hand<string>('hands', player).sort()).toEqual(expected);
        expect(owners.assetsOf('assets', player).sort()).toEqual(expected);
      }
      expect(board.entries('board').length).toBe(cells.size);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          expect(board.get('board', { x, y })).toBe(
            cells.get(`${x},${y}`) ?? null,
          );
      const before = structuredClone({
        bagState,
        ownerState,
        cardState,
        gridState,
      });
      expect(() => bag.transfer('bag', to, 1, 'missing')).toThrow();
      expect(() => card.transfer('hands', to, 1, 'missing')).toThrow();
      expect(() =>
        owners.transfer('assets', item, model.get(item)!, 0),
      ).toThrow();
      expect(() => board.set('board', { x: width, y: 0 }, item)).toThrow();
      expect({ bagState, ownerState, cardState, gridState }).toEqual(before);
      new GameInventoryController(structuredClone(bagState), rng, undefined, [
        bagDefinition,
      ]).assertValid();
      new GameOwnershipController(structuredClone(ownerState), undefined, [
        ownerDefinition,
      ]).assertValid();
      new GameCardsController(structuredClone(cardState), rng, undefined, [
        deck,
        hands,
      ]).assertValid();
      new GameGridController(structuredClone(gridState), [
        gridDefinition,
      ]).assertValid();
    }
  },
);
