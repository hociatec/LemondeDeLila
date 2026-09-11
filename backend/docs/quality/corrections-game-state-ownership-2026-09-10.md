# Ownership de l'état — points 112, 116, 120, 121 et 122 clôturés

Les composants génériques sont les propriétaires uniques de leurs données :
cartes, pistes, dés, inventaires, marchés, ownership, pions, grilles et quiz.
L'auditeur rejette les doublons dans l'état spécifique d'un jeu et couvre les
champs centraux de score et de tours supplémentaires. Les scénarios de tous les
jeux sont inclus dans la validation.

Preuves : `src/game/testing/architecture-tests/game/backend-debt-auditor.ts`,
`backend-debt-contracts.spec.ts` et
`src/game/core/infrastructure/tests/all-games.scenario-coverage.spec.ts`.
