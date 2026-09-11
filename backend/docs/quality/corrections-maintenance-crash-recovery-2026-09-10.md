# Récupération du verrou de maintenance après crash

Le verrou fichier contient le PID du propriétaire. À la prochaine acquisition,
un verrou dont le PID n’existe plus est supprimé immédiatement ; un PID vivant
reste protégé et le TTL historique continue de traiter les cas anciens. La
publication atomique et la protection Redis restent inchangées.

Preuves :

- `src/modules/admin/infrastructure/system/filesystem-admin-maintenance-lock.service.ts`
- `src/modules/admin/infrastructure/system/filesystem-admin-maintenance-lock.service.spec.ts`
- test de récupération d’un PID disparu
- `npm run typecheck`
