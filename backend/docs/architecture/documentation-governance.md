# Gouvernance documentaire

Propriétaire : équipe backend. Dernière revue : 2026-09-01. Prochaine revue :
2026-12-01.

Les sources canoniques sont :

- configuration : `src/platform/config/environment-validation.ts`, dont
  `.env.example` est contrôlé automatiquement;
- architecture et frontières : `tools/architecture-contract.json` et les ADR;
- WebSocket : registrars TypeScript, qui génèrent `contracts/asyncapi.json`;
- base de données : migrations TypeORM et test d'intégration MySQL;
- exploitation : `security-and-operations.md` et les scripts exécutables;
- qualité : scripts `quality:check`, sans copie manuelle de leurs seuils.

Toute documentation qui répète une valeur vérifiable doit soit la générer, soit
pointer vers sa source canonique. Les ADR et runbooks portent un propriétaire et
une date de revue. La CI vérifie la dérive des contrats générés et des variables
d'environnement.
