# Contrat des instants métier

Les conversions entre l’horloge métier en millisecondes, `Date` et ISO sont
désormais centralisées dans `businessMsToDate`, `businessMsToIso` et
`parseExplicitInstant`. Le writer Vault utilise ces frontières explicites ;
les dates entrantes sans fuseau explicite sont refusées par le parseur.

Preuves :

- `src/shared/utils/date-serialization.ts`
- `src/modules/vault/application/services/vault-snapshot-writer.service.ts`
- `src/shared/utils/date-serialization.spec.ts`
- `src/modules/vault/application/services/vault-room-snapshots.service.spec.ts`
- `npm run typecheck`
