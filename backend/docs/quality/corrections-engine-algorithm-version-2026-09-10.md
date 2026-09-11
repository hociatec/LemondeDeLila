# Versionnement de l’algorithme moteur

Les nouveaux états déclaratifs enregistrent `algorithmVersion` dans leur
en-tête moteur. Le chargeur accepte les snapshots historiques qui n’ont pas
ce champ (compatibilité version 1), mais rejette explicitement toute version
future ou incompatible. Une évolution déterministe incompatible doit donc
faire évoluer cette constante et fournir la migration/stratégie de rejet
correspondante avant déploiement.

Preuves :

- `src/game/engine/runtime/engine-algorithm-version.ts`
- `src/game/engine/runtime/state/declarative-state.factory.ts`
- `src/game/engine/runtime/content/game-state-loader.ts`
- `src/game/engine/runtime/content/game-state-loader.spec.ts`
- `npm run typecheck`
