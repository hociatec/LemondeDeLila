# Correction WX v2 — signature de l’installeur

Le contrat canonique `lila-client-wx-manifest-v2` inclut désormais
`installerSha256`, avec la valeur `-` lorsqu’aucun installeur n’est publié.

La publication et la lecture du manifeste construisent toutes deux ce même
payload avant vérification RSA-SHA256. Toute modification de l’empreinte de
l’installeur invalide donc la signature, comme celle de l’archive principale.

Preuves :

- `src/modules/update/domain/wx-update-manifest.ts`
- `src/modules/update/infrastructure/persistence/wx-update-publication.manager.ts`
- `src/modules/update/infrastructure/persistence/wx-update-artifact-validator.service.ts`
- `src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts`
- `npx jest src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts --runInBand`
- `npm run typecheck`
