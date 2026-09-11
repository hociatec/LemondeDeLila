import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
require('ts-node').register({ transpileOnly: true, project: path.join(root, 'tsconfig.json') });
const { discoverGameDefinitions } = require('../src/game/composition/game-module-discovery.ts');
const { assertGameDefinition } = require('../src/game/engine/runtime/definitions/game-definition-validator.ts');
const games = new Set(fs.readdirSync(path.join(root, 'src/game/games/les-quatre-vents'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
const definitions = discoverGameDefinitions().filter((definition) => games.has(definition.id));
assert.equal(definitions.length, games.size, 'Every installed game must be discovered');
const reports = definitions.map((definition) => {
  assertGameDefinition(definition);
  const decks = definition.components.filter((component) => component.component === 'cards.deck');
  if (definition.id === 'ca-derape') assert.equal(decks.reduce((total, deck) => total + deck.cards.length, 0), 80, 'Ca Derape must retain its 80 cards');
  if (definition.id === 'odyssee-quatre-cieux') {
    assert.equal(definition.content.data.trackLength, 56);
    assert.equal(definition.content.data.homeLength, 6);
  }
  return {
    game: definition.id,
    contentVersion: definition.contentVersion,
    rulesVersion: definition.rulesVersion,
    cardsTotal: decks.reduce((total, deck) => total + deck.cards.length, 0),
    decks: decks.map((deck) => ({ id: deck.id, cards: deck.cards.length })),
    components: definition.components.length,
    validation: 'canonical compiler and content schemas',
  };
});
const out = path.join(root, 'logs/les-quatre-vents-audit.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ auditedAt: new Date().toISOString(), reports }, null, 2) + '\n');
console.log('Les Quatre Vents: ' + reports.length + ' compiled games validated; ' + out);
