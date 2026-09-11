# Assertions doubles aux frontières

Le point 293 est clôturé pour le code de production. Le dernier `as unknown as`
dans `HealthController` a été remplacé par un lecteur validant les compteurs
internes du pool SQL. Les compteurs doivent être des entiers sûrs non négatifs,
avec un nombre de connexions libres inférieur ou égal au total. Un pilote sans
ces diagnostics ne produit pas de mesure artificielle de saturation.

Le lint de production, migrations comprises, interdit les assertions doubles
via `unknown`, y compris avec parenthèses ou assertions TypeScript à chevrons.
Les fichiers de tests conservent cette possibilité pour construire des fixtures
volontairement partielles et inspecter des projections inconnues ; cette exception
ne concerne aucun chemin exécuté par le serveur. Les interdictions existantes de
hasard et d'horloge système dans les jeux restent actives.

Validation : deux suites de santé, onze tests réussis ; test du lint réel sur les
quatre syntaxes interdites, un jeu et l'exception de fixture ; typage et lint complet
réussis. Le test du garde est intégré à `architecture:test`, donc à `quality:check`.
Journaux `logs/corrections-double-cast-*`.
