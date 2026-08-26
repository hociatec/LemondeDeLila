# Quality Guardrails

Date : 2026-08-24

## Scripts

- `npm run quality:report` génère `backend/tools/quality-report.json`.
- `npm run quality:check` échoue si une limite du contrat qualité est dépassée.
- `npm run test:transverse` exécute la suite transverse minimale de sécurité.
- `npm run game-engine:audit` impose l'API moteur V2 sans baseline ni exception historique.

## Contrat qualité v2

Le fichier `backend/tools/quality-baseline.json` contient des limites absolues,
pas une tolérance de dette historique.

Violations bloquantes, avec une limite fixée à zéro :

- parsing manuel des payloads d'action ;
- texte source présentant un encodage mojibake.

Les compteurs suivants sont conservés comme observations, car leur présence
est légitime et leur volume seul ne caractérise pas une dette :

- constructions d'états `pending` ;
- accès à `scoresByPlayerId` ;
- configuration `targetScore` ou `targetPoints`.

Une évolution de ces observations doit être évaluée sémantiquement en revue de
code, et non bloquée par un seuil arbitraire.

## Architecture

- Contrat : `backend/tools/architecture-contract.json`.
- Documentation : `backend/ARCHITECTURE.md`.
- Tests du vérificateur : `npm run architecture:test`.
- Baseline : `backend/tools/architecture-baseline.json`.
- Politique : aucune violation architecturale n'est tolérée dans la baseline.

## Moteur de jeux V2

L'audit spécialisé bloque toute réintroduction de modules/services/presenters par
jeu, de couches framework dans un jeu, d'une entrée autre que `game.ts`, des
anciens symboles moteur, de `any`, de doubles casts, de casts de metadata, de
`Math.random()`/`Date.now()` dans les règles et des fichiers de jeu de plus de
550 lignes. Chaque manifeste doit fournir les cinq entrées standard et son test
doit utiliser `GameTestKit`. Cette vérification exige toujours zéro violation.

## CI

- Workflow : `.github/workflows/backend-quality.yml`.
- Gate PR backend : `build` + `test:transverse` + `quality:check`.
