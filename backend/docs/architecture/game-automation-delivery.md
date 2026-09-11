# Livraison et reprise des automatismes

L'état de session, ses événements et ses snapshots sont enregistrés dans une
même transaction SQL. Cet état constitue l'intention durable du prochain
automatisme. BullMQ sert à réveiller le moteur à l'échéance ; une écriture
Redis perdue après le commit ne doit pas bloquer définitivement la partie.

`GameAutomationRecoveryService` relit les clés de sessions au démarrage puis
par pages de 100, toutes les cinq secondes. La pagination utilise le couple
`roomId, gameType` et repart du début après chaque parcours. Les lectures SQL
sont bornées à une seconde. Une erreur de session n'empêche pas les autres
sessions d'être traitées ; une erreur de page conserve le curseur. Le prochain
parcours retente les intentions non livrées. Le délai maximal de reprise
dépend donc du nombre de pages et de la disponibilité de SQL et Redis.

Le plan est recalculé sur l'état persistant courant. L'identité du job inclut
la session, la version, la restauration, le contenu, les règles et la signature
du plan. Réémettre la même intention ne repousse pas un job déjà présent.
À l'exécution, une intention périmée est abandonnée ou remplacée par le plan
courant. Les commandes automatiques ont des identifiants stables ; le verrou
de room, les reçus de commandes et le compare-and-set empêchent les doubles
mutations. Les jobs définitivement échoués restent consultables dans BullMQ,
avec métrique et journal `game.task.dead-letter` ; ils ne sont pas effacés par
la reprise périodique.

Le timer local ne contient aucune intention métier : perdre ce timer ou
redémarrer une instance ne perd pas l'état SQL. L'arrêt ferme cette source et
draine les opérations acceptées avant de fermer les ressources.

Redis Pub/Sub transporte les notifications d'interface et la présence, pas
les commits ni les commandes automatiques. La présence utilise des snapshots
par origine, des séquences, des heartbeats et une expiration. Les notifications
durables se relisent dans leur inbox SQL ; les notifications éphémères et les
rafraîchissements de lobby restent sans garantie de livraison. Les statistiques
de room existantes sont également collectées en best effort et ne participent
ni à la décision de victoire ni au commit du jeu. Une exigence future de
comptabilité exhaustive devra leur ajouter une intention durable par run.

Les tests de reprise couvrent réémission, panne SQL, isolation d'une session
illisible, pagination et arrêt. Les tests du scheduler et des contrats de
tâches couvrent les doublons, restaurations, générations et échéances.
