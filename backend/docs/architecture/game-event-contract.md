# Contrat du journal de jeu

Les nouveaux événements persistés portent `schemaVersion: 1`. Ce numéro
décrit leur format ; `version` reste la version de l'état et `seq` leur ordre
dans la partie. Les événements historiques sans `schemaVersion` sont lus
comme le format 1, sans réécriture. Toute version explicite inconnue est refusée.

L'émission valide les objets avant de les copier : les instances de classes,
dont les Entities ORM, ne deviennent pas silencieusement des DTO par clonage.
Le journal capture les données et la visibilité au moment de l'émission.
Les projections publiques utilisent une liste explicite de propriétés et
copient uniquement les données accessibles au joueur. Les champs internes
ou ajoutés à l'enveloppe ne sont pas propagés automatiquement.

Le replay trie les événements par séquence et exige une séquence continue
après le snapshot sélectionné. Il rejette les doublons, les trous, les commits
sans patch et les opérations malformées. Un jeu ne peut pas émettre le type
réservé `engine.state.committed`. Les clés de patch susceptibles de modifier
un prototype sont refusées.

Le tampon accepte au maximum 128 événements avant commit : un dépassement
échoue au lieu de supprimer les anciens événements. La limite de 100 000
événements du journal inclut tous les événements du nouveau commit.
Le simulateur consomme son tampon à chaque étape et expose son historique
dans `GameSimulationResult.events`. Ses compteurs incluent aussi la dernière
étape d'une simulation arrêtée à la limite de commandes.

Le contrat de déclarations SDK passe de 6.1 à 6.2. Cette version est distincte
du format 1 du journal. Le champ `schemaVersion` reste optionnel dans le modèle
de stockage pour représenter les données historiques, mais il est toujours
présent dans les nouvelles écritures et les projections d'événements persistés.

Ces validations concernent le journal du moteur. Elles ne constituent pas une
garantie de livraison des publications cross-domain ; les chantiers outbox,
inbox et idempotence restent distincts.
