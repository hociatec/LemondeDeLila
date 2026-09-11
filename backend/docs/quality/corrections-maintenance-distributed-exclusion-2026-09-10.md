# Exclusion distribuée de la maintenance

La maintenance peut exiger explicitement le bail Redis distribué avec
`ADMIN_MAINTENANCE_REQUIRE_DISTRIBUTED=true`. Dans ce mode, l’absence du
service Redis ou l’échec d’acquisition refuse l’opération ; le verrou fichier
local reste une seconde protection. Le comportement est couvert par un test
de refus sans bail.

Preuves :

- `src/modules/admin/infrastructure/system/filesystem-admin-maintenance-lock.service.ts`
- `src/modules/admin/infrastructure/system/filesystem-admin-maintenance-lock.service.spec.ts`
- `.env.example`
- `npm run typecheck`
