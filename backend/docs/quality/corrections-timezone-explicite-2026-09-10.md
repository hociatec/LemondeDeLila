# Fuseau explicite aux frontières de date

Les dates entrantes des contrats WX et des filtres d’administration sont
désormais analysées par `parseExplicitInstant`, qui exige `Z` ou un offset
numérique. Les conversions du calendrier de bannissement restent explicites
en UTC. Le serveur ne dépend donc pas de la timezone locale pour ces règles.

Preuves :

- `src/shared/utils/date-serialization.ts`
- `src/modules/update/infrastructure/persistence/wx-update-artifact-validator.service.ts`
- `src/modules/admin/application/use-cases/admin-users/admin-users-query.service.ts`
- `src/modules/user/domain/policies/user-ban.policy.ts`
- tests de dates et de validation WX
- `npm run typecheck`
