# Arrêt ordonné du serveur

Le bootstrap installe `installGracefulShutdown` après l'écoute HTTP. Cette
fonction est l'entrée d'arrêt de production pour SIGTERM et SIGINT ; elle
renvoie également une fonction d'arrêt programmatique idempotente. Les hooks
Nest natifs restent responsables de fermer les ressources, après le drainage.
Ne pas appeler directement `app.close()` pour arrêter une instance en service :
cet appel natif commence par détruire les modules. Ne pas ajouter en parallèle
`enableShutdownHooks`, qui contournerait l'ordre ci-dessous.

1. Refuser les nouvelles requêtes et upgrades WebSocket, puis fermer l'écoute
   HTTP. Le middleware retourne 503 avec `Connection: close` sur les connexions
   encore utilisables ; les nouveaux messages WS reçoivent une fermeture 1012.
2. Arrêter les sources de travail : nettoyage périodique, heartbeat de présence,
   acquisition de nouveaux jobs BullMQ. `worker.close()` attend le job actif ;
   la queue et sa connexion Redis restent disponibles pour les effets en cours.
3. Attendre les commandes acceptées et leurs effets suivis. L'intercepteur HTTP
   conserve la promesse métier même si le client abandonne sa réponse. Les
   quatre frontières WS suivent connexion, commande et nettoyage de session.
   Le quota Redis est suivi séparément, car les guards précèdent l'intercepteur.
4. Fermer toutes les sockets avec 1001, attendre le handshake et terminer après
   une seconde les sockets qui ne répondent pas. Cette seconde borne seulement
   la fermeture du transport, jamais la durée d'une mutation.
5. Attendre les écritures déclenchées par la déconnexion et la fin du serveur
   HTTP, puis appeler les hooks Nest pour fermer DB, Redis et autres ressources.

Les statistiques de début/fin de partie, sorties de salle, invitations,
notifications d'amis et nettoyage d'inbox sont attendus par leurs appelants.
Les opérations différées du scheduler sont enregistrées dans le suivi partagé.
Un départ différé de participant ne démarre plus pendant l'arrêt.

La file d'écriture du scheduler appartient à `GameTaskDispatchService`, séparée
du calcul des actions automatiques. Les lots de mutations parallèles utilisent
`allCompleted` : la première erreur est conservée, mais elle n'est propagée
qu'une fois toutes les branches terminées. Les lectures parallèles indépendantes
peuvent conserver la sémantique habituelle de `Promise.all`.

Le suivi appartient à l'instance Nest : pas de singleton mutable de processus.
Les paramètres par défaut servent aux instanciations directes des tests ;
l'injection de production est explicite et obligatoire.

## Échecs et limites

Une erreur d'arrêt d'une source est remontée et journalisée. Le serveur n'appelle
pas volontairement `process.exit()` ni ne ferme les ressources sous une mutation
encore active. Le superviseur doit laisser assez de temps pour le drainage ;
SIGKILL, arrêt matériel et panne de connexion restent des arrêts non gracieux.
Les protections transactionnelles, CAS et tâches persistées restent nécessaires.
Les commandes d'administration qui lancent un processus système détaché ont leur
propre cycle de vie et ne sont pas converties en tâches locales de shutdown.

Les tests utilisent une vraie application Nest/HTTP et une vraie connexion WS.
L'attente BullMQ est vérifiée avec des doubles contrôlés ; cette série ne prouve
pas une campagne Redis/BullMQ réelle ni le comportement d'un superviseur donné.
