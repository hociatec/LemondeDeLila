#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const {
  GENERATED_GAME_DEFINITIONS,
} = require('../src/game/composition/generated-game-registry');

if (!Array.isArray(GENERATED_GAME_DEFINITIONS))
  throw new Error('Registry de jeux déclaratifs invalide');
if (GENERATED_GAME_DEFINITIONS.length !== 39)
  throw new Error(
    `Catalogue JSON incomplet: ${GENERATED_GAME_DEFINITIONS.length}/39`,
  );
for (const [index, definition] of GENERATED_GAME_DEFINITIONS.entries()) {
  if (
    typeof definition !== 'object' ||
    definition === null ||
    definition.kind !== 'lila.game-definition'
  )
    throw new Error(`Définition JSON non compilée à l'index ${index}`);
}
console.log(
  `validate-json-games: OK (${GENERATED_GAME_DEFINITIONS.length} jeux compilés sans démarrer le backend)`,
);
