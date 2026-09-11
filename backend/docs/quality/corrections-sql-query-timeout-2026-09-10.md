# Correction SQL — timeout général des requêtes

La configuration MySQL expose maintenant `DB_QUERY_TIMEOUT_MS` et la transmet
à TypeORM via `maxQueryExecutionTime`. Le driver MySQL l’utilise comme délai
de requête, en plus du timeout de connexion existant. La valeur par défaut est
30 secondes et les valeurs sont bornées à 100–120 000 ms.

Preuves :

- `src/platform/database/mysql-connection-options.ts`
- `src/platform/config/environment-validation.ts`
- `src/platform/database/mysql-connection-options.spec.ts`
- `.env.example`
- `npm run typecheck`
