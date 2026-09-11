# Contrat durable du SDK — point 65

Le contrôle des noms exportés est complété par une référence des déclarations
TypeScript et de leurs dépendances transitives. Les 81 fichiers atteignables
depuis la façade sont compilés en mémoire puis comparés à une référence suivie
dans le dépôt. Les signatures indirectes et les contrôleurs exposés à travers
des types mappés sont couverts. La commande de qualité exécute le contrôle et
ses tests ; elle ne réécrit jamais la référence automatiquement.

La version d'API 5.0.0 et la migration depuis le contexte de classe sont
explicites dans l'ADR-006. La procédure de revue, de versionnement et de mise à
jour de référence est décrite dans [sdk-contract.md](../architecture/sdk-contract.md).
Le contrôle conservateur peut signaler une modification de déclaration interne ;
une revue distingue celle-ci d'une rupture publique. La compatibilité des
comportements reste du ressort des tests de jeux.

Six tests de l'outil vérifient les changements de payload, retour, optionalité,
readonly, contraintes/défauts génériques, surcharges, tuples, imports indirects,
cycles et contrôleurs mappés. Ils vérifient aussi que les corps d'implémentation
n'affectent pas la référence, que les chemins sont portables et qu'une erreur de
compilation empêche la capture. `quality:check` complet réussi, journal
`logs/corrections-sdk-quality.log`. Les tests de contrats auteur, lint, build et
vérifications du dist de la série précédente restent valides : le complément
ajoute un outil de contrôle, sans modification du runtime.
