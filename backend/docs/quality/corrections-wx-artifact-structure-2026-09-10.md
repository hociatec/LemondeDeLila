# Correction WX — structure des artefacts

La validation WX ne se limite plus aux magic bytes. Une archive ZIP doit
contenir un EOCD cohérent, au moins une entrée et un en-tête de répertoire
central valide. Un installateur doit être un PE x64 avec signature `PE\0\0`,
offset valide et au moins une section.

Preuves :

- `src/modules/update/infrastructure/persistence/wx-update-artifact-validator.service.ts`
- `src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts`
- test de rejet des fichiers qui usurpent `PK`/`MZ`
- `npm run typecheck`
