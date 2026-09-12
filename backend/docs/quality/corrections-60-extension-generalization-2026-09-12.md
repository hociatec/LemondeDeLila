# Clôture des 60 points de généralisation des extensions

Statut : **60 points traités et vérifiés**.

| Points | Correction et preuve |
| --- | --- |
| 1–9 | Les 12 720 lignes de production sont maintenant comptées par extension, et non plus seulement via `program.ts`. Le rapport distingue les 12 304 lignes spécifiques et rend immédiatement visibles Sac, Contes, Gérard, Rites, Cat Pattes, Dérape et tous les autres profils. Les deux totaux sont des budgets CI non croissants. |
| 10–11, 30–34 | Les 39 commentaires de classification ont été retirés. Le catalogue structuré déclare classification et raison ; l'audit publie pour chaque profil sa famille, ses consommateurs réels, ses LOC et sa raison. Une extension spécifique est explicitement considérée comme mécanique unique jusqu'à ce qu'un second consommateur prouve une abstraction partagée. |
| 12–17, 19 | Tous les profils appartiennent exactement à une famille revue : course, collection, cartes, plateau, choix ou spatial. Les profils de course, de familles/collections, de cartes et de plateau sont ainsi comparables dans un même rapport. `game:duplication` confirme qu'aucune fonction normalisée n'est dupliquée entre deux jeux ; les différences restantes ne justifient donc pas une abstraction partagée aujourd'hui. Les primitives génériques restent sur liste blanche et les budgets empêchent le retour silencieux de logique locale. |
| 18, 20–26 | Le registre explicite, figé et déterministe est conservé comme racine de composition. Les schémas, compilateurs, handlers et validations restent dérivés de ce registre et le noyau ne connaît aucune clé spécifique. |
| 27–29, 37–40, 60 | Le générateur `--json-only` prouve qu'un jeu standard se crée avec `game.json`, `manifest.json` et `rules.md`, sans TypeScript ni nouvelle extension. Les 39 jeux existants possèdent leur `game.json`, aucun fichier TypeScript de production, et la limite modulaire de 301 lignes reste bloquante. |
| 35–36 | `runtime-dependency-graph.spec.cjs` analyse tout `src`, imports de types et alias compris. Son test global est exécuté par `architecture:test`, lui-même inclus dans `quality:check`. |
| 41–57 | `maintained-invariants-audit.cjs` rattache explicitement la structure du contenu, les références, le DSL fermé et borné, l'immutabilité, les versions/migrations/snapshots, la sérialisation, la convergence, le RNG, l'atomicité, les jobs rejouables, les projections, les secrets, les API, l'horloge et l'absence de doubles casts à leurs audits et tests bloquants. |
| 58 | Room et Vault restent deux frontières métier distinctes ; aucune fusion artificielle n'est introduite. Les audits de placement et de dépendances continuent de protéger cette séparation. |
| 59 | Le workflow CI possède maintenant un job d'intégration réelle MySQL/Redis/BullMQ/deux instances et un job de release qui typecheck, construit, vérifie `dist`, retire les dépendances de développement et fabrique l'artefact de déploiement reproductible. Docker n'est pas le format de livraison : il sert uniquement aux dépendances d'intégration. |

Commandes de preuve locales :

```text
npm run engine:effects:audit
npm run architecture:test
npm run invariants:audit
npm run game:content-structure:audit
npm run game-engine:audit
npm run typecheck:prod
npm test -- --runInBand
```

La CI ajoute `npm run test:integration:real`, `npm run build`,
`npm run verify:dist` et `npm run artifact:create` dans un environnement Linux
propre. Les tests avec services externes ne sont pas remplacés par une
affirmation locale : leur résultat appartient au job d'intégration réelle.
