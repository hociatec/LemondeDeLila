# Correction du point 643 — compilation des schémas du runtime

Les fabriques de `gameInput` capturent les schémas enfants, options, listes et
alternatives lors de la construction de la définition. Le parsing d’une action
réutilise ensuite ces fonctions préparées ; il ne reconstruit ni schéma,
descripteur, liste d’options ni expression régulière dynamique.

Preuves : `game-input-schema-capture.spec.ts` vérifie la capture après mutation
du schéma source et `compilation-contracts.spec.ts` vérifie la compilation
unique des définitions. Validation ciblée :
`npm run test -- --runInBand src/game/engine/runtime/actions/game-input-schema-capture.spec.ts src/game/engine/runtime/definitions/compilation-contracts.spec.ts`.
