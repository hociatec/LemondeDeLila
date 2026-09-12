# Migrations de snapshots moteur

Le chargeur restaure un clone et fait passer son en-tête par
`migrateEngineSnapshot` avant de vérifier les versions du jeu et de son contenu.
Un snapshot sans `algorithmVersion` appartient explicitement au moteur **1** ;
il ne sera pas réinterprété comme appartenant à une future version courante.

Lors d'un changement incompatible d'algorithme, augmenter
`GAME_ENGINE_ALGORITHM_VERSION`. Une reprise exige une transformation synchrone
explicitement validée dans `ENGINE_SNAPSHOT_MIGRATIONS` ; en son absence, le
snapshot est refusé. Ce registre appartient au moteur, pas au JSON auteur.
La version actuelle est 2 : `has-card` reconnaît les cartes objets par leur
identifiant. Une ancienne continuation pourrait choisir une branche différente.
Aucune migration 1 → 2 ne garantit cette équivalence : le registre reste vide.
Avant de déployer ce moteur, terminer les parties de version 1 sur leur ancien
runtime ou conserver ce runtime pour leur durée de vie. Réécrire seulement
l'en-tête n'est pas une migration valide. Cette contrainte vaut également pour
les snapshots historiques sans en-tête, qui appartiennent à la version 1.

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

Le journal des 256 dernières commandes contient désormais une empreinte
optionnelle `requestFingerprint` au format `v1:<SHA-256>`. Elle couvre le type,
le contenu, l'acteur résolu par le serveur et les métadonnées métier (dont
`schedulerId`). L'ordre des clés d'objets est canonique ; l'ordre des tableaux
reste significatif. `commandId`, `knownVersion` et l'acteur fourni dans les
métadonnées ne participent pas à l'empreinte. La version client peut donc être
actualisée lors d'une relance sans refaire la mutation. Le libellé d'affichage
est également exclu.

Les reçus historiques sans empreinte restent chargeables, mais leur réutilisation
est refusée : le serveur ne peut pas prouver l'égalité avec un contenu qu'il
n'a pas conservé. Aucune empreinte fictive n'est calculée pendant la migration.
Les nouveaux identifiants restent utilisables dans ces parties. Une relance
identique vérifiable ne génère ni mutation ni nouvel événement ; une collision
est rejetée. La protection persistante du moteur est limitée aux 256 reçus
conservés ; la protection WS possède sa propre fenêtre de rétention et doit
encore être partagée entre les instances pour terminer le point 69.

## Fidélité JSON avant clonage

La validation de sérialisabilité précède le clonage dans le service moteur, les restaurations et CAS mémoire/SQL, ainsi que la création et la lecture des snapshots du journal. Elle reste obligatoire lorsque la limite de taille est désactivée. Une instance personnalisée, une closure, un getter, une propriété cachée, un tableau creux ou une valeur numérique non finie est refusé avant toute écriture.

Les propriétés optionnelles d'objet à undefined sont omises par le codec JSON ; undefined dans un tableau est refusé. Le seul codec d'instance accepté est le Date natif de metadata.roomStartedAt, historiquement fourni par Room : JSON le représente en texte ISO. Les autres Dates, sous-classes, faux objets Date et sérialisations personnalisées sont refusés. Le contrôle utilise les primitives natives et accepte les Dates natives provenant d'un autre contexte d'exécution.
