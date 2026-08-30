# ADR-005 — BullMQ et planification

Statut : accepté.

BullMQ est un réveil distribué, pas la source de vérité d'une échéance métier.
Le plan durable (`dueAtMs`, signature et génération) reste dans l'état MySQL de
la partie. À la livraison, le worker recharge cet état et ignore tout job
annulé, obsolète ou déjà appliqué. Un `commandId` stable et le CAS rendent une
livraison en double inoffensive.

Les jobs utilisent retry et backoff ; retard, retry et dead letter sont
mesurés. Les workers et queues sont fermés par le graceful shutdown. Les tests
Redis/BullMQ réels couvrent délai, retry, suppression, redémarrage et deux
workers concurrents ; les tests applicatifs couvrent doublon et job obsolète.

Les timers sans conséquence métier durable restent locaux : heartbeat,
reconnexion, debounce, délai de déconnexion, scan idempotent de rooms et
programmation administrative explicitement éphémère d'une mise à jour client.
Le scan des rooms se reconstruit depuis MySQL après restart ; la programmation
admin est annulée au shutdown. Leur inventaire est verrouillé par
`scheduling:audit`. La politique détaillée demeure dans
`durable-game-scheduling.md`.

