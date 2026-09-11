'use strict';
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true });
const { discoverGameDefinitions } = require('../src/game/composition/game-module-discovery');
const games = discoverGameDefinitions().filter(game => game.id === 'panier-express');
assert.equal(games.length, 1);
const definition = games[0];
assert.equal(definition.content.data.actions.roll.recipe, 'board-roll');
assert.equal(definition.content.data.actions.draw_card.recipe, 'board-draw');
assert.equal(definition.content.data.board.tiles.length, 40);
assert.equal(definition.rulesVersion, '2');
for (const id of ['market-items', 'shopping-lists', 'shopping-baskets']) {
  assert.equal(definition.components.find(c => c.component === 'inventory.set' && c.id === id).visibility, 'owner');
}
console.log('Panier wiring: one JSON definition in the production registry, private inventory projections');
