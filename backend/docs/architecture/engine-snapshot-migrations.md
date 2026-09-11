# Migrations de snapshots moteur

Le chargeur restaure un clone et fait passer son en-tête par
`migrateEngineSnapshot` avant de vérifier les versions du jeu et de son contenu.
Un snapshot sans `algorithmVersion` appartient explicitement au moteur **1** ;
il ne sera pas réinterprété comme appartenant à une future version courante.

Lors d'un changement incompatible d'algorithme, augmenter
`GAME_ENGINE_ALGORITHM_VERSION` et ajouter une transformation synchrone dans
`ENGINE_SNAPSHOT_MIGRATIONS`. Ce registre appartient au moteur, pas au JSON auteur.
La version actuelle étant toujours 1, aucun changement de comportement ni
transformation historique n'est nécessaire dans le registre de production.

Le chemin complet doit exister avant d'exécuter sa première transformation.
Une version ne peut avoir qu'une sortie ; les cycles, chemins manquants et
chaînes de plus de 64 étapes sont refusés. Chaque transformation agit sur le
clone et doit conserver les versions du schéma de jeu, du contenu et des règles.
Une exception ou un état non sérialisable empêche la restauration sans modifier
le snapshot source. Les migrations de contenu restent un contrat distinct.

Les tests exercent une transformation réelle en deux étapes, la conservation du
snapshot original, le refus des changements d'identité, des graphes ambigus et
des sorties non sérialisables. Une nouvelle migration de production devra aussi
apporter un fixture historique et son état cible attendu.
