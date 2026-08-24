# Quality Guardrails

Date : 2026-08-24

## Scripts

- `npm run quality:report` génère `backend/tools/quality-report.json`.
- `npm run quality:check` échoue si une limite du contrat qualité est dépassée.
- `npm run test:transverse` exécute la suite transverse minimale de sécurité.

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

## CI

- Workflow : `.github/workflows/backend-quality.yml`.
- Gate PR backend : `build` + `test:transverse` + `quality:check`.
