# Restauration, publication et logs

Revue du 8 septembre 2026. Le relevé point par point est dans
`docs/quality/corrections-lot-min100-2026-09-08.md`.

## Frontière de restauration Vault

Le snapshot Vault porte `version: 1`. Le décodeur vérifie son enveloppe, sa
date, les identifiants et leur unicité, la capacité de la salle et la forme de
l'état. Le runtime vérifie ensuite les versions exactes `schemaVersion`,
`rulesVersion` et `contentVersion`, ainsi que la sérialisabilité et les invariants
de l'état. Une incompatibilité est rejetée ; aucune conversion générale
implicite d'une ancienne sauvegarde n'est tentée.

La restauration crée une nouvelle salle. Elle ne remplace pas une partie
existante. Il s'agit d'une opération avec compensation, et non d'une transaction
SQL couvrant tous les modules : après création, un échec d'ajout de joueur, de
bot ou de restauration du jeu entraîne une tentative de destruction de la salle
créée. L'erreur initiale est conservée et un échec de compensation est signalé.
La réussite de `game.restoreState` constitue la frontière de commit. Ensuite,
les notifications sont best-effort, indépendantes pour chaque joueur ; leur
échec ne détruit plus une partie restaurée avec succès.

Les métadonnées de provenance, noms des bots et ambiance restent best-effort.
Une interruption du processus entre la création et la compensation peut
nécessiter une réconciliation : cette correction n'apporte pas de journal de
compensation durable ni d'invisibilité transactionnelle de la salle en cours
de restauration.

## Uploads et publication

Les entrées HTTP utilisent le stockage disque Multer. Un son est limité à
250 Mio avant et après encodage ; le buffer chargé après validation de taille
reste donc borné par upload. Les sorties cumulées stdout/stderr des outils
audio sont limitées à 1 Mio. Les archives WX sont assemblées par flux et leur
taille exacte est contrôlée ; la limite par artefact est de 2 Gio par défaut,
configurable par `CLIENT_WX_MAX_ARTIFACT_BYTES`. Ces limites individuelles ne
remplacent pas une limite globale de travaux audio concurrents. Les processus
audio sont limités à deux simultanément par instance et seize en attente.
L'attente expire après `SOUND_PROCESS_QUEUE_TIMEOUT_MS` (15 s par défaut,
120 s maximum) ; saturation et expiration répondent avec une erreur 503.
Les attentes expirées sont retirées de la file et ne démarrent jamais plus tard.

Les noms originaux ne choisissent pas les fichiers publiés. Les sons utilisent
une clé validée et un SHA-256 ; WX emploie un identifiant de release contrôlé,
une version validée et des noms construits par le serveur. Les fichiers audio
sont examinés avec ffprobe/ffmpeg, puis transcodés et contrôlés avant écriture
du manifeste. L'analyse de silence échouée ou incomplète est rejetée. Le
transcodage limite les threads d'encodage et de filtrage à un, avec une échéance
`SOUND_TRANSCODE_TIMEOUT_MS` (30 s par défaut). Les sondes et analyses de silence
ont leurs propres échéances, respectivement 10 s et 20 s. Ce sont des bornes
de durée et de parallélisme interne, pas un quota CPU global du système.

Le répertoire temporaire de transcodage est supprimé aussi quand le démarrage
de ffmpeg échoue. Les blocs finally nettoient les autres sorties temporaires
connues. Le nettoyage universel après crash ou pour toutes les erreurs de
chunks WX reste à compléter (point 347).

La publication écrit les fichiers complets avant de remplacer atomiquement le
manifeste. WX prépare une release dans `.staging` avant renommage ; compléter
l'installateur d'un répertoire existant passe aussi par un fichier de staging
et un renommage, jamais par une copie progressive vers son URL finale. Un
échec de copie préserve l'absence d'installateur et l'ancien manifeste.
Les écritures atomiques asynchrones réessaient au plus cinq fois un renommage
Windows refusé temporairement (`EPERM`, `EACCES`, `EBUSY`), avec 150 ms d'attente
cumulée maximale. La destination publiée n'est jamais supprimée pour faciliter
le remplacement. Un refus persistant laisse la valeur antérieure intacte.

Les SHA-256 des artefacts WX sont vérifiés avant publication. Le manifeste v2
signe les champs canoniques de l'archive principale. L'empreinte de
l'installateur n'est pas incluse dans cette signature : le point 352 reste
ouvert. Les contrôles d'en-têtes ZIP/PE ne constituent pas une validation
exhaustive de leur structure ; le point 342 reste également ouvert.

## Logs et métriques

Nest utilise `ServLoggerService`. `GameLoggerService` conserve son contexte jeu
et utilise le même assainissement des valeurs, erreurs et messages JSON déjà
sérialisés. Les clés de payload, action, texte privé et identifiants secrets
sont masquées ; cookies, autorisations et credentials d'URL sont masqués dans
les formes prises en charge. La récursion est bornée et les cycles sont
remplacés. L'identifiant de corrélation du contexte asynchrone est ajouté par
les deux loggers ; les tâches sans requête ne fabriquent pas un request ID.

Les événements opérationnels contiennent le nom d'événement, les identifiants
room/game/run ou commande pertinents, versions et durées, sans journaliser
les actions utilisateur complètes par défaut. Les identifiants techniques ne
doivent pas être remplacés par email, token ou contenu de discussion.
Le masquage ne prétend pas reconnaître toute PII dans un texte libre : 374
reste ouvert pour une revue exhaustive des messages métier.

Niveaux : `error` pour l'échec nécessitant une investigation ; `warn` pour un
rejet ou fonctionnement dégradé ; `info` pour le cycle métier ; `debug` pour
le diagnostic détaillé ; `verbose` pour le diagnostic framework. Le fallback
de création du dossier de logs passe par le logger Nest. L'unique exception
console est l'erreur fatale de bootstrap dans `main.ts`, assainie, nécessaire
lorsque le logger applicatif n'a pas pu être initialisé.

La rétention locale est bornée en volume : 5 fichiers de 5 Mio pour `serv.log`,
et autant pour chacun des flux jeu `combined.log` et `error.log`. Ce n'est pas
une durée de conservation. Une collecte externe doit appliquer sa propre
politique. Les payloads privés restent exclus même au niveau debug.

Prometheus est porté par la plateforme, avec latences HTTP/WS, disponibilité
DB/Redis, saturation du pool DB et nombres de jobs BullMQ par état. La liveness
teste l'event loop ; la readiness effectue quatre contrôles de dépendances,
dont le ping DB. Les métriques de parties actives, erreurs moteur par code et
échecs de restauration restent ouvertes (381–383). Le choix de toutes les
capacités Redis critiques reste à corriger (386).

## Configuration MySQL et limites de validation

`createMysqlConnectionOptions` est commun à Nest et à la CLI TypeORM.
`DATABASE_URL` prévaut sur les champs séparés. `DB_POOL_SIZE` vaut 10 et
`DB_CONNECT_TIMEOUT_MS` 10000 par défaut et `DB_QUERY_TIMEOUT_MS` 30000 par
défaut ; leurs bornes et celles du port sont
vérifiées sans recopier les valeurs sensibles dans les erreurs. Nest limite
ses retries de connexion au démarrage avec `DB_STARTUP_RETRY_ATTEMPTS` (5) et
`DB_STARTUP_RETRY_DELAY_MS` (1000). Il ne s'agit pas de retries de requêtes ou
de mutations. Le timeout général des requêtes SQL reste à traiter (448).

Les tests de ce lot utilisent des fichiers temporaires réels et de vrais
sous-processus Node pour les limites audio. Les tests MySQL/Redis/BullMQ de
contrat utilisent des doubles ; ils ne prouvent pas une campagne réelle de
panne ou de concurrence distribuée. Aucun déploiement ni migration de données
persistées n'est effectué dans ce lot.
