# Planification durable des actions de jeu

Les échéances métier (`dueAtMs`) et les actions attendues restent dans l'état de
jeu persistant. BullMQ n'est qu'un mécanisme de réveil distribué : chaque job
contient la room, le type de jeu, la signature du plan et la génération (version)
de l'état qui l'a créé.

Le moteur dépend uniquement du port `GameTaskScheduler`. L'adapter BullMQ peut
être remplacé sans modifier les règles ou le runtime. Il utilise Redis via
`GAME_TASK_REDIS_URL`, puis `GAME_ENGINE_STATE_REDIS_URL` ou
`SESSION_STORE_REDIS_URL` en repli. En production, Redis est obligatoire.

À la livraison d'un job, le worker recharge l'état, recalcule le plan et vérifie
sa signature, sa génération et son échéance. Une livraison obsolète ou annulée
est donc inoffensive. Une tâche expirée est exécutée immédiatement. Toute action
valide passe par `GameCommandExecutorService`, reçoit un `commandId` stable, puis
est persistée par compare-and-set. Deux workers concurrents ne peuvent ainsi
valider qu'une seule transition.

Les jobs utilisent cinq tentatives avec backoff exponentiel. Les échecs terminaux
restent dans l'état `failed` de BullMQ et sont journalisés comme dead letters.
Les métriques distinguent planifications, exécutions, annulations, retries,
dead letters et retard d'exécution. La fin ou la suppression d'une partie annule
les jobs de la room ; une livraison déjà active reste protégée par les contrôles
du moteur.

Les heartbeats WebSocket, délais de déconnexion et regroupements très courts ne
sont pas des échéances métier et restent volontairement locaux. Aucun polling
MySQL n'est utilisé pour la planification.

`room-auto-cleanup` est un balayage périodique idempotent : après redémarrage il
recalcule les rooms éligibles depuis MySQL et ne porte aucune échéance métier.
La programmation d'une mise à jour client par un administrateur est une commande
d'exploitation éphémère, volontairement annulée au redémarrage ; elle ne modifie
aucun agrégat avant sa diffusion. Les timeouts audio/HTTP, debounce, reconnexion,
présence et délai de déconnexion sont également locaux et possédés par un hook de
destruction.

`npm run scheduling:audit` inventorie chaque appel local à `setTimeout` ou
`setInterval`, vérifie son propriétaire et interdit toute nouvelle utilisation
non classée. Une échéance durable nouvelle doit passer par un port de scheduler,
jamais être ajoutée à cette liste par commodité.

`npm run test:redis:bullmq` utilise Redis et de vrais workers BullMQ pour prouver
les délais, retries, annulations, reprise après arrêt d'un worker, concurrence et
double livraison d'une même commande logique. Le test applicatif
`game-realtime-automation.service.spec.ts` prouve séparément que cette double
livraison ne peut produire qu'un commit CAS.
