# Quality Guardrails

Date: 2026-02-18

## Scripts
- `npm run quality:report`: génère `backend/tools/quality-report.json`
- `npm run quality:check`: échoue si régression vs `backend/tools/quality-baseline.json`
- `npm run test:transverse`: suite transverse minimale de sécurité

## Baseline
- Fichier: `backend/tools/quality-baseline.json`
- Politique: les dettes existantes sont tolérées, toute augmentation est bloquante.

## CI
- Workflow: `.github/workflows/backend-quality.yml`
- Gate PR backend: `build` + `test:transverse` + `quality:check`
