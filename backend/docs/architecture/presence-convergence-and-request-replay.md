# Présence distribuée et replay des requêtes

## Présence

Chaque processus possède ses connexions locales et publie une projection complète
identifiée par son UUID de démarrage. Le champ `sequence` augmente à chaque demande
de publication. Une réponse de lecture des salles devenue obsolète est abandonnée
avant publication, même si elle termine après une réponse plus récente.

Le récepteur retient la plus grande séquence de chaque origine et ignore les
doublons et messages anciens. Une rediffusion du même message ne renouvelle pas
sa durée de vie. La séquence ne définit pas d'ordre global entre les instances.
Les producteurs historiques sans séquence utilisent leur timestamp pour l'ordre ;
ils ne peuvent pas remplacer un état déjà reçu avec séquence pour la même origine.

La durée de vie est de 120 secondes après réception locale. L'horloge de l'émetteur
ne décide plus de cette expiration : un timestamp futur ne maintient pas de présence
fantôme. Les lectures excluent les origines expirées et les diffusions périodiques
répercutent cette disparition. Le heartbeat se déclenche toutes les 30 secondes
tant qu'il existe des connexions locales. La disparition visible dépend donc aussi
du prochain rafraîchissement du client ou de cette diffusion.

Une annonce perdue est remplacée par une prochaine projection complète ; aucun
delta manquant n'est nécessaire pour reconstruire la présence. Si le processus
s'arrête ou si Redis reste indisponible, ses annonces finissent par expirer chez
les autres récepteurs. La présence reste une information éventuellement cohérente,
pas une preuve transactionnelle d'existence d'une salle ou d'autorisation.

Les dernières séquences sont retenues après expiration avec une liste de joueurs
vide, pour empêcher la résurrection par un doublon. La mémoire est limitée à
10 000 origines : à saturation une origine expirée est oubliée ; si aucune ne
l'est, une nouvelle origine est refusée. La déduplication ne couvre plus une origine
oubliée. Les UUID de processus évitent les remises à zéro de séquence sous le même ID.

Les joueurs sont copiés et limités aux champs publics avant mémorisation.
Les objets du cache, y compris les salles imbriquées, sont gelés ; ni l'annonce
reçue ni le résultat d'une lecture ne peuvent modifier une présence mémorisée.
Une annonce contenant un joueur invalide ou deux fois le même identifiant est
rejetée sans consommer sa séquence.

La fusion conserve la priorité des activités. À priorité égale, l'ordre ordinal
des identifiants d'origine départage les métadonnées ; la dernière interaction
reste le maximum reçu. La liste finale est triée par identifiant de joueur.
Un ordre différent de réception produit donc la même projection pour le même
ensemble d'annonces.

## Redis Pub/Sub

Pub/Sub ne fournit ni historique durable, ni accusé de traitement, ni reprise des
messages perdus. Les erreurs de publication sont journalisées et ne constituent
pas une file persistante. Cela vaut aussi pour les notifications : une poussée
directe perdue peut manquer au client, y compris une demande de déconnexion.
Les éléments déjà persistés dans la boîte de notifications sont récupérables par
lecture de celle-ci ; une poussée transitoire ne bénéficie pas automatiquement
de cette propriété. Les exigences de livraison fiable des événements critiques,
d'outbox et d'idempotence générale restent au backlog.

## Replay WebSocket

La portée est le processus serveur, puis l'utilisateur authentifié (ou la
connexion anonyme), le scope API, la salle, le type de jeu et le requestId.
Une reconnexion du même utilisateur dans ce processus retrouve son résultat.
Un changement de salle dispose d'un espace distinct. Le cache n'est pas partagé
entre instances et ne survit pas à un redémarrage.

Le type de commande, son payload JSON canonique et les rôles du contexte authentifié
sont liés par une empreinte SHA-256. L'ordre des clés d'objet n'est pas significatif.
Un payload modifié, un autre type de commande ou des rôles différents provoquent
un conflit explicite avant exécution. Le cache ne journalise pas les payloads.
Les requêtes sans requestId restent compatibles mais ne sont pas dédupliquées.

Le TTL est de cinq minutes à partir de la fin du traitement. Une commande en cours
n'expire pas et n'est pas évincée. Les appels concurrents attendent le même résultat.
La capacité de 10 000 entrées peut évincer un résultat terminé avant son TTL ;
si toutes les entrées sont en cours, les nouvelles commandes protégées sont refusées.
Cette fenêtre bornée n'est donc pas une garantie générale d'exécution unique.

Un refus avant exécution libère l'entrée. Un ancien callback d'échec ne peut pas
supprimer une entrée plus récente portant la même clé. Les réponses terminées sont
copiées avant mémorisation. Un timeout réseau ne prouve pas l'annulation d'un effet
métier ; les garanties transactionnelles et distribuées restent nécessaires pour
les opérations sensibles au-delà de cette fenêtre locale.
