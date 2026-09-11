# Centralisation des conversions de date métier

## Point traité

Le point 550 exige que les conversions d'une horloge métier soient centralisées
à la frontière, afin d'éviter des conversions `Date` dispersées et des formats
ISO construits de manière incohérente.

## Implémentation

- `businessMsToDate` et `businessMsToIso` valident et convertissent les
  millisecondes métier au même endroit.
- Les services de salles, statistiques, notifications, messagerie, utilisateurs
  et stockage Mnemo passent par ces helpers.
- Le contexte d'exécution des jeux utilise également le helper ISO commun.
- Les conversions de dates restent aux frontières de persistance, présentation
  ou sérialisation ; les tests conservent une horloge numérique déterministe.

## Vérification

- `npm run typecheck -- --pretty false`
- `npm run test -- --runInBand src/shared/utils/date-serialization.spec.ts`
- `rg` ne trouve plus de conversion `new Date(this.clock...)` ou
  `new Date(this.now...)` en production.
