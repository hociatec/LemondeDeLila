# Migrations d'état — point 130 clôturé

Les compatibilités de contenu sont résolues par un registre unique dans le
runtime. Les migrations sont parcourues comme un graphe borné : les chaînes
multi-étapes sont acceptées, les cycles sans cible ne bouclent pas et les
versions sans chemin sont rejetées sans modifier le snapshot source.

Preuves : `content-migration-registry.ts`, `game-state-loader.ts` et les 15
tests de `game-state-loader.spec.ts`.
