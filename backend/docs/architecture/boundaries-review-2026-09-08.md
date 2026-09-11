# Revue des frontières, sessions et dates

Propriétaire : équipe backend. Revue : 2026-09-08.

## Entrées et authentification

Le middleware HTTP borne les corps JSON à 256 Kio et les formulaires à 64 Kio /
200 paramètres. `isBoundedJsonInput` vérifie avant toute normalisation récursive
une profondeur maximale de 32 et 10 000 nœuds, les nombres finis, l'absence de
cycles et de clés `__proto__`, `constructor`, `prototype`, y compris imbriquées.
Les enveloppes WS API/Room et les messages Presence/Notification passent par le
même contrôle avant routage et ont leur limite d'octets propre (16 Kio Presence,
64 Kio Notification). Les DTO WS exigent un objet et refusent les champs inconnus.
La conversion implicite des objets/nombres en chaînes est désactivée : envoyer les
types JSON déclarés ; seules les conversions explicitement déclarées sur un DTO
restent possibles. La normalisation NFKC/trim préserve les credentials opaques.
La validation métier/DB exhaustive (295) n'est pas attestée par ces gardes JSON.

`security-boundary-audit` inspecte les controllers HTTP et handlers WS. Les
ressources sont inventoriées dans [authorization-resource-matrix](authorization-resource-matrix.md).
Authentifier le JWT/ticket établit l'identité ; `requireAdmin` et les policies
de ressource déterminent les actions autorisées. Les handlers transmettent l'acteur
de session aux use-cases. L'audit statique garde des exceptions documentées pour
les routes publiques et l'authentification à la connexion ; il ne démontre pas la
réévaluation des rôles ou bans sur chaque socket existant (397 reste ouvert).

HTTP CORS utilise la liste `CORS_ORIGINS` ; aucune origine navigateur acceptée
par défaut en production. L'adapter WS applique maintenant la même liste au
handshake, compare l'origine exacte et rejette `null`, les origines malformées et
les suffixes de domaine trompeurs. Un client natif peut omettre Origin ; la
vérification du JWT et du ticket reste indépendante. Aucun cookie d'authentification
n'est émis par ces flux : les credentials sont des tokens explicitement fournis,
pas une session navigateur envoyée automatiquement. Si une auth cookie est ajoutée,
ses paramètres secure/httpOnly/sameSite et sa protection CSRF devront être définis.

Le chemin API possède un quota par connexion (`WS_RATE_LIMIT_COUNT` sur
`WS_RATE_LIMIT_WINDOW_MS`, défaut 60/10 s), avant le handler de login, messagerie,
tchat API et invitation. C'est une limitation réelle mais locale, réinitialisable
par reconnexion. Elle ne satisfait pas le point 413 ni une protection dédiée des
commandes coûteuses sur tous les endpoints Room (411 reste ouvert). Le tchat
direct Presence/Room reste également à limiter (409). HTTP utilise
le stockage Redis de throttling en production. Les uploads sons/WX ont leurs
plafonds de taille indépendants du quota de requêtes.

## Refresh tokens et configuration

`RedisRefreshTokenService` émet 48 octets aléatoires en base64url. Seul le SHA-256
du token entre dans la clé Redis ; le record stocke un userId numérique positif
safe integer et un TTL. La rotation consomme l'ancien record par un script Lua
GET/DEL atomique avant d'émettre le remplacement. Un identifiant stocké comme
booléen, chaîne ou tableau est désormais refusé. Le logout supprime le digest.
Le use-case révoque le token remplacé si l'utilisateur a disparu ou est banni.
Les tests couvrent ces contrats avec un double Redis ; pas de campagne Redis réelle.

La rotation n'est pas une révocation globale de famille de tokens. Le logout
n'invalide pas un JWT déjà délivré ni tous les sockets ; le point 418 reste ouvert.
Un crash entre consommation et émission impose une nouvelle connexion. Les clés
JWT sont obligatoires, RS256 est imposé et aucun secret JWT de repli n'existe.
`JWT_EXPIRES_IN` exige une durée positive avec unité s/m/h/d ; un nombre nu comme
`120` est refusé pour éviter l'interprétation en millisecondes. La tolérance est
bornée à 0–300 secondes. Le schéma Joi distingue required, optional et default ;
la validation exhaustive des variables consommées (281) reste distincte.

## Bannissements

`user/domain/policies/user-ban.policy.ts` est le contrat commun à login, refresh,
presence et administration pour les expirations de compte/tchat. `null` et
`undefined` signifient aucune interdiction ; une date égale ou antérieure à
l'horloge est expirée ; une date future est active. Une date invalide refuse
l'accès, sans la transformer en autorisation ni appeler toISOString dessus.
Presence renvoie alors `until: null` dans son refus explicite.

L'administration valide aussi les entrées directes de use-case. Les jours sont
des durées entières de 24 heures, entre 1 et 36 500 ; les changements d'heure ne
modifient plus la durée du ban de compte. Une date seule signifie minuit UTC ;
une date-heure doit avoir Z ou un offset explicite et une vraie date de calendrier.
Le ban de membership Room est un ensemble d'identités, sans `bannedUntil` : il
reste une politique Room distincte. Le cache de ban tchat et la révocation des
sessions existantes restent des limitations séparées de l'interprétation des dates.

## Dates et ordre des données

`serializeDate` refuse les dates persistées absentes ou corrompues ;
`serializeOptionalDate` projette l'absence en null. Les chemins tchat/admin et
notifications ne remplacent plus une date historique invalide par « maintenant ».
Le mapper SQL des notifications refuse aussi les dates invalides ; son contrat
best-effort existant journalise l'échec et renvoie une collection vide.
Les champs propres d'une notification ont priorité sur les extensions du payload.

Une nouvelle date de création (écriture d'un message, snapshot, notification) est
légitime ; elle n'est pas un fallback de lecture. `presentationTimestamp` désigne
l'instant de génération d'une enveloppe. Les règles déterministes utilisent
`GameClock.nowMs()` en millisecondes Unix ; `nowIso()` est sa représentation UTC
pour événements et metadata, pas une deuxième horloge. Les délais de scheduler
sont des millisecondes. La mesure technique utilise `hrtime.bigint`, distincte
de l'horloge civile ; l'injection généralisée de BusinessClock reste ouverte.

Le contenu calcule sa version via `stableJson` (clés d'objet triées, ordre des
tableaux et collections conservé). Le replay WS utilise une canonicalisation
triée récursive puis SHA-256 : permuter les clés d'un payload ne change pas sa
commande. Cette définition ne prétend pas que le tri localeCompare du contenu
est identique entre toutes les versions ICU ; le point 710 reste ouvert.
