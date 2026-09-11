# Protection des informations sensibles

## Point traité

Le point 618 interdit de compiler ou d'exposer des secrets, tokens, mots de
passe et clés privées hors de leur frontière nécessaire.

## Garantie

Les secrets restent dans les services de configuration/authentification ; les
DTO, projections de jeux, réponses de santé et journaux utilisent des formes
réduites. Les tokens sont stockés sous forme de clé dérivée lorsqu'un index est
nécessaire, et les erreurs ne réinjectent pas les URLs de connexion.

## Vérification

- `npm run security:audit`
- `ws-security.services.spec.ts` et `redis.health.spec.ts` vérifient les
  frontières d'exposition.
- `backend-debt-check` confirme l'absence de casts et de catches silencieux.
