# Disponibilité des capacités Redis

L'ancien indicateur vérifiait uniquement la première URL moteur/session trouvée.
Il pouvait annoncer une disponibilité correcte alors qu'un serveur distinct de
quotas, de présence, de notifications ou de tâches était inaccessible.

Le contrôle suit maintenant les URL effectivement choisies par les providers :

| Capacité indispensable | Sélection de configuration |
| --- | --- |
| Sessions et jetons | SESSION_STORE_REDIS_URL, sinon REDIS_URL |
| Quotas | RATE_LIMIT_REDIS_URL, sinon SESSION_STORE_REDIS_URL |
| Présence | PRESENCE_REDIS_URL, sinon SESSION_STORE_REDIS_URL |
| Notifications | NOTIFICATION_REDIS_URL, sinon SESSION_STORE_REDIS_URL |
| Tâches | GAME_TASK_REDIS_URL, sinon GAME_ENGINE_STATE_REDIS_URL, sinon SESSION_STORE_REDIS_URL |

Une configuration requise absente ou une sonde en échec rend readiness négative.
Les URL identiques sont sondées une seule fois ; les cinq cibles au maximum sont
contrôlées en parallèle. Une URL moteur qui n'est plus sélectionnée par les tâches
n'est pas sondée inutilement. Le Redis dédié au cache de projection des tables
reste facultatif : sa panne seule ne retire pas la disponibilité métier.

Chaque sonde a une échéance technique de deux secondes, sans reconnexion ni
file de commandes hors ligne. Elle déconnecte son client et libère son timer,
même après un échec ou une connexion bloquée. Ce timer est recensé dans l'audit
des délais locaux : il ne remplace aucune tâche métier durable.

Le contrôle des compteurs BullMQ conserve sa limite de jobs échoués. Sa lecture
et sa fermeture sont également bornées à deux secondes chacune ; sa connexion
est déconnectée avant fermeture de la queue. Une erreur de nettoyage n'empêche
pas l'autre nettoyage et ne remplace pas le résultat du contrôle.

Les réponses publient les états des capacités, sans URL ni exception de connexion
contenant potentiellement des identifiants. Liveness reste indépendante de Redis.
Les seize tests ciblés couvrent les cinq pannes distinctes, la déduplication,
l'absence de configuration, le cache facultatif, les délais et les nettoyages.
Ces tests simulent les pannes ; aucune instance Redis de production n'a été arrêtée.
