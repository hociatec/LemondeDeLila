'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { GENERATED_FILES, createGame } = require('./create-game.cjs');

test('create-game generates only the five declarative files', async () => {
  const gamesRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'lila-create-game-'),
  );
  try {
    const directory = await createGame({
      gamesRoot,
      world: 'vents-tests',
      code: 'high-card',
      name: 'High Card',
      category: 'Cartes',
      minPlayers: 2,
      maxPlayers: 6,
    });

    assert.deepEqual(
      fs.readdirSync(directory).sort(),
      [...GENERATED_FILES].sort(),
    );
    const game = fs.readFileSync(path.join(directory, 'game.ts'), 'utf8');
    assert.match(game, /export default defineGame/);
    assert.doesNotMatch(game, /@nestjs|Module|Service|Presenter|registr/i);
    assert.doesNotMatch(
      fs.readFileSync(path.join(directory, 'rules.ts'), 'utf8'),
      /@nestjs|Math\.random|Date\.now/,
    );
  } finally {
    await fsp.rm(gamesRoot, { recursive: true, force: true });
  }
});

test('create-game refuses invalid identifiers and existing folders', async () => {
  const gamesRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'lila-create-game-'),
  );
  const configuration = {
    gamesRoot,
    world: 'tests',
    code: 'valid-game',
    name: 'Valid',
    category: 'Test',
    minPlayers: 2,
    maxPlayers: 4,
  };
  try {
    await assert.rejects(
      createGame({ ...configuration, code: '../escape' }),
      /Code invalide/,
    );
    await createGame(configuration);
    await assert.rejects(createGame(configuration), /existe déjà/);
  } finally {
    await fsp.rm(gamesRoot, { recursive: true, force: true });
  }
});
