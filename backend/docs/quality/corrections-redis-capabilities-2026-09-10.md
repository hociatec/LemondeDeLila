# Capacités Redis — point 386 clôturé

La readiness ne sonde plus seulement une URL Redis prioritaire : elle construit
les cibles réellement utilisées par chaque capacité obligatoire, déduplique les
endpoints communs et conserve l'association capacité/URL dans le résultat.
Une panne d'une capacité requise rend la readiness négative.

Preuves : `redis-readiness-targets.ts`, `redis.health.ts` et
`redis.health.spec.ts`, notamment les scénarios multi-URL et les fallbacks.
