# Horloge métier

`BusinessClock.now()` fournit des millisecondes depuis l'époque Unix. Elle sert
aux décisions applicatives qui comparent des dates ou des délais.
`platform/time/BusinessClockModule` associe ce port à `SystemBusinessClock`.
Presence, Catalog et Bot importent ce module technique commun.

`PresenceService` l'utilise pour les interactions, la publication et l'expiration
des origines distantes. `PresenceChatService` l'utilise pour la durée du cache
des bannissements et leur expiration. Aucun de ces services n'appelle directement
`Date.now()`. Les tests pilotent une horloge indépendante du temps système et
vérifient les limites d'expiration, notamment à égalité avec la date de fin.

`CatalogCacheService` et `BotNameCacheService` l'utilisent aussi pour leur TTL.
Leurs tests contrôlent la limite exacte d'expiration et les lectures concurrentes
à une invalidation, sans attente réelle.

Cette horloge civile n'est pas une horloge monotone : une synchronisation système
peut la déplacer. Les mesures de latence et les métriques conservent leur horloge
technique ; elles ne doivent pas utiliser BusinessClock pour calculer une durée
de performance. Les timers du heartbeat restent des mécanismes techniques de
déclenchement. Les autres caches, sessions et invitations doivent encore être
audités avant de déclarer la migration des horloges complète.

Les services Room, Chat, Messaging, Bug Reports, Notification, Stats et les
notifications administratives injectent désormais une `BusinessClock`
obligatoire. Les factories Nest transmettent cette dépendance et leurs modules
importent `BusinessClockModule`. Aucun fallback `clock?.now() ?? Date.now()`
ne subsiste. Les adaptateurs système sont possédés par `platform/time`.

`GameCommandExecutorService` mesure ses durées avec `performance.now()` ; les
horodatages métier des événements utilisent le contexte d'exécution. Les erreurs
de validation n'inventent plus de timestamp système : elles conservent le contexte
fourni par leur appelant. `gameNowDate()` convertit l'instant de l'unique scope
moteur via `businessMsToDate`.
