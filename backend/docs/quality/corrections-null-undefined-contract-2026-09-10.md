# Contrat `null` / `undefined` des payloads

## Points traités

Les points 554 à 556 demandent une distinction explicite entre valeur absente,
omission JavaScript et `null` sur les frontières publiques.

## Implémentation

`normalizeOptional` définit la règle commune : une entrée `null` ou
`undefined` représente l'absence et devient `null` au contrat. La
`serializeOptionalDate` applique cette règle avant d'émettre les dates
optionnelles ; les champs obligatoires continuent de rejeter les valeurs
absentes ou invalides. Ainsi, une propriété optionnelle n'est pas remplacée par
une valeur courante implicite et le format wire est stable.

## Vérification

- `src/shared/utils/date-serialization.spec.ts` couvre `null`, `undefined` et
  une valeur présente.
- `npm run test -- --runInBand src/shared/utils/date-serialization.spec.ts`
- `npm run typecheck -- --pretty false`
