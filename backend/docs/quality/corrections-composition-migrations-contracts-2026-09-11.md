# Composition TypeORM et garde-fous d'architecture

Le registre et son test sont déplacés de `src/` vers `src/app/database/`.
Nest, le CLI TypeORM et le test des relations Room utilisent ce registre unique.
Le test du registre continue de parcourir tout `src/` et contrôle que chaque
entité persistée est enregistrée exactement une fois. Les entités restent dans
le contexte propriétaire ; `platform/database` ne dépend pas des modules métier.

Points traités de la version courante de `corriger.txt` :

- **182** : le contrôle d'architecture interdit aux migrations les dépendances
  vers le code applicatif courant. Seuls les imports d'autres migrations,
  de TypeORM et des modules natifs Node sont autorisés. Les migrations existantes
  respectent cette règle.
- **196** : le même contrôle interdit les fichiers `.model.ts` et `.record.ts`
  sous tout dossier `contracts`, y compris dans les sous-dossiers. Les contrats
  actuels respectent cette règle.

Ces règles font partie de `architecture:check`, déjà exécuté par `quality:check`.
Les tests utilisent des fixtures invalides et valides, sans élargir la baseline.
L'analyseur couvre aussi `require()`, les imports de types `import()` et les
imports TypeScript `import = require()`.

Validation : les 22 tests de `architecture-check.spec.cjs` passent et
`architecture:check` ne rapporte aucune violation.
Le contrôle TypeScript passe également, ainsi que les trois suites Jest ciblées
(5 tests : registre ORM, relations Room et contrats des migrations).
`npm run build` réussit, y compris le chargement du module applicatif compilé.

L'audit de disposition signale encore trois anomalies hors de ce lot : le
dossier `game/engine/runtime/contracts` absent de son catalogue et les noms
`bot-strategy.interface.ts` / `game-runtime.interface.ts` sous `application/ports`.
Les autres points de `corriger.txt` restent ouverts. Les anciens rapports de
clôture utilisent une numérotation antérieure ; ils ne prouvent pas la clôture
des points réintroduits dans la liste actuelle.
