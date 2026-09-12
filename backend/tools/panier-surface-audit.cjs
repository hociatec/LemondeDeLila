'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/game/games/les-quatre-vents/panier-express');
function walk(directory) { return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }
const code = walk(root).filter(file => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
assert.deepEqual(code, [], 'Panier must not contain executable TypeScript rules');
require('ts-node').register({ transpileOnly: true });
const { resolveJsonContent } = require('../src/game/engine/json/public-api');
const { jsonContentAssets } = require('../commands/json-content-assets.cjs');
const assets = Object.fromEntries(jsonContentAssets(root).map(asset => [asset.relative, JSON.parse(fs.readFileSync(asset.file, 'utf8'))]));
const document = resolveJsonContent(JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8')), assets);
assert.equal(document.schemaVersion, 1);
assert.equal(document.victory.kind, 'by-board');
assert.ok(document.board.tiles.some(tile => tile.operations.some(op => op.kind === 'finish-collection')));
console.log('Panier surface: zero production TypeScript files; rules and content in game.json');
