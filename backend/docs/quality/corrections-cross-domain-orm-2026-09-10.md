# Frontières ORM inter-domaines — points 198–207 et 211–217 clôturés

Les couches applicatives ne consomment plus les entités TypeORM ni le modèle
User universel d'un autre domaine. Les besoins transverses passent par des
ports et des projections minimales (`UserRef`, lecteurs de participants et
contrats de repository). Les entités restent dans l'infrastructure de
persistence de leur module propriétaire.

Preuves : `tools/architecture-check.cjs`, `tools/persistence-audit.cjs`,
les ports applicatifs des modules Room, Presence, Social et User, et
`npm run typecheck`.
