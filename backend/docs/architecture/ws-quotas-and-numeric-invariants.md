# Quotas WebSocket et invariants numériques

## Quotas

`WsRequestRateLimitService` utilise `RedisRateLimitStorage`, également utilisé
par le throttler HTTP. Les messages API (dont les commandes Game), Room (dont
le chat), Presence et Notification consomment un budget WS commun par utilisateur.
Une autre connexion ou un autre processus ne crée pas de nouveau budget.
L'incrément et le blocage utilisent un script Lua atomique.

Configuration : `WS_RATE_LIMIT_COUNT` (60 par défaut),
`WS_RATE_LIMIT_WINDOW_MS` (10 000 ms par défaut). Le dépassement bloque pendant
une fenêtre supplémentaire. HTTP conserve ses propres fenêtres et namespaces.
Toutes les instances doivent pointer vers le même `RATE_LIMIT_REDIS_URL`
(repli sur `SESSION_STORE_REDIS_URL`) et employer les mêmes paramètres.

Avant authentification, API utilise l'adresse du pair TCP, sans faire confiance
aux en-têtes transférés. Derrière un proxy, les clients anonymes de ce proxy
partagent donc un quota. Une adresse absente partage le groupe `unknown`.
Le passage d'anonyme à authentifié adopte le budget de l'utilisateur.

Un refus intervient avant le dispatch métier et avant le replay API.
Room renvoie `WS_RATE_LIMITED`, API une enveloppe d'erreur corrélée ; Presence
et Notification ferment avec 1013. Une panne Redis ou une réponse invalide
refuse la commande. Il n'existe pas de compteur local de secours.
Le quota porte sur les commandes entrantes ; il ne limite pas le nombre de
connexions ni les notifications sortantes. Les messages malformés API/Room
peuvent être rejetés par le décodeur avant consommation du quota.

## Invariants du moteur

Les scores, ressources et compteurs peuvent être négatifs et fractionnaires
(pénalités, dettes). Ils doivent être finis, de valeur absolue inférieure ou
égale à `Number.MAX_SAFE_INTEGER`. Les résultats et deltas d'une modification
respectent aussi cette borne. Cela ne transforme pas les fractions JS en
arithmétique décimale exacte.

Les contrôleurs génériques appliquent ces règles avant mutation. Une dépense
est non négative et exige un solde suffisant ; un transfert de ressources
utilise un entier strictement positif et vérifie le destinataire avant débit.
Les valeurs persistées de playerValues sont contrôlées lors de la validation
de session. Les durées restantes de statut et nombres de tours planifiés sont
des entiers non négatifs ; null reste la durée de statut non chiffrée.

Les inventaires acceptent des quantités entières non négatives, au plus
100 000 objets par inventaire de joueur. Les achats vérifient la capacité et
les ventes le futur solde avant de déplacer les actifs ; un ajustement de prix
non fini ou hors limites est refusé avant transaction.

Les définitions de dés limitent count à 100 et sides à 1 000 000 ; les politiques
limitent extraDice, attempts et reroll.max à 100. Le résultat maximal est vérifié
avant allocation et consommation du RNG. Les pistes ont au plus 1 000 000 cases
et un déplacement au plus 100 000 pas en valeur absolue. Un déplacement simple
n'alloue plus la liste des cases traversées sans callback onPass.

Ces bornes protègent les opérations modifiées. Elles ne prouvent pas encore
l'exhaustivité des limites de tous les délais, extensions de jeu, composants,
restaurations et ciblages du moteur : les exigences générales restent au backlog.

Les tests couvrent les refus sans mutation/événement, les jeux existants et le
partage de budget avec stockage simulé. L'intégration Redis réelle reste à
exécuter sur un environnement disposant de Redis.
