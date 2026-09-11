Tests spécifiques à Panier Express
=================================

Panier Express est défini intégralement par `../game.json`.

Les tests de comportement sont dans `../game.spec.ts`. Ils compilent le JSON
avec l'entrée publique du moteur et vérifient notamment l'initialisation,
les inventaires privés, les déplacements et la pioche manuelle.

Les tests transversaux sont dans :

- `game/testing/architecture-tests/game/panier-json-parity.spec.ts` : trois
  traces de 150 commandes comparées aux événements de l'ancienne implémentation ;
- `game/engine/runtime/definitions/json-board-schema.spec.ts` : refus des
  collisions, références invalides, capacités absentes et cartes mal formées ;
- `game/testing/architecture-tests/game/content-snapshot-migrations.spec.ts` :
  refus des snapshots de règles 1 dont les continuations ne sont plus compatibles.

Les audits `panier:effects:audit`, `panier:wiring:audit` et
`panier:surface:audit` contrôlent le catalogue, le registre et l'absence de
TypeScript de production dans ce paquet.

