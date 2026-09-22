# Reprise des automatisations et verrous

La session SQL et sa timeline constituent l'intention durable. Redis et ses jobs
peuvent être reconstruits ; les notifications Pub/Sub ne sont pas un journal.

Le recovery prend un bail Redis global avant de scanner SQL. Il vérifie ce bail
pendant le scan et avant de planifier. Un passage traite au plus dix pages de
100 sessions et vérifie le budget d'une seconde après chaque session. Le curseur
reprend également au milieu d'une page. Une lecture SQL déjà engagée peut dépasser
ce budget ; celui-ci n'est pas un délai maximal d'exécution SQL. Les pages
restantes reprennent après 250 à 1 250 ms, au lieu de cinq secondes par page.
Après un balayage complet, la prochaine passe attend 5 à 6 secondes. Le premier
passage arrive après 1 à 1 000 ms. Les durées d'I/O s'ajoutent à ces délais :
il ne s'agit pas d'une garantie de récupération instantanée. La gigue désynchronise
les instances ; les reconnexions Redis et les retries BullMQ en utilisent aussi.

Une session illisible est conservée dans SQL. Ses tentatives sont espacées de
5, 10, 20, 40, 80, 160 puis 300 secondes au maximum. Le journal contient la clé
de session et `retryAfterMs`, avec les secrets masqués. La quarantaine locale est
bornée à 10 000 entrées ; un redémarrage permet une nouvelle tentative. Elle ne
supprime aucune partie et une ligne corrompue n'empêche pas les suivantes d'avancer.
À la fin d'un balayage SQL complet, les entrées de quarantaine qui n'ont plus
été rencontrées sont retirées : une partie supprimée ou devenue non récupérable
ne maintient pas indéfiniment une fausse alerte. Une page interrompue, un budget
épuisé ou une erreur SQL ne provoquent pas cette purge. Les sessions encore
présentes mais différées conservent leur délai progressif de nouvelle tentative.
Pour un runtime absent, restaurer le runtime et les archives de contenu compatibles,
puis laisser le retry reprendre. Ne pas remplacer le contenu d'une ancienne session
par celui d'une nouvelle version sans migration explicite.

Métriques : `lila_game_recovery_sessions_total` (cinq résultats fixes),
`lila_game_recovery_pass_seconds`, `lila_game_recovery_deferred_sessions` et
`lila_game_recovery_sweeps_total`. Les alertes `LilaRecoverySessionsDeferred` et
`LilaRecoveryStalled` signalent une quarantaine persistante ou l'absence de
balayage complet. Aucun identifiant de joueur ou de salle n'est un label.
En cas d'alerte : vérifier les dépendances Redis/SQL, les journaux de recovery,
les versions de runtime/contenu, puis observer une reprise des sweeps.

Les baux Redis échouent définitivement dès qu'un renouvellement ou une lecture
d'appartenance échoue, et après leur échéance monotone locale. `acquire()` renvoie
`null` uniquement en cas de contention ; Redis absent provoque une erreur dans
tous les environnements. Les timers sont arrêtés à la libération/perte/shutdown.
La readiness vérifie également le Redis réellement sélectionné pour ces baux :
`UPDATE_REDIS_URL`, puis `REDIS_URL`, puis `SESSION_STORE_REDIS_URL`.
Lorsque plusieurs capacités utilisent la même URL, une seule connexion de sonde
est ouverte. Une panne du Redis des baux empêche donc un état de readiness sain.

Les sondes d'écriture disque utilisent un nom unique par appel. Des appels
concurrents à `/health` et `/health/ready` ne partagent pas leur fichier temporaire.
Une sonde ne nettoie un fichier que si elle l'a créé elle-même ; un échec
d'ouverture ne lui donne pas le droit de supprimer un fichier déjà présent.

Un bail ne constitue pas à lui seul un fencing token accepté par une ressource
externe. Les publications et finalisations WX conservent donc aussi un verrou
sur le volume contenant les fichiers. Ces verrous ne sont jamais volés sur la
seule base de leur ancienneté. Un processus suspendu peut reprendre bien après
le TTL Redis. Le nettoyage des temporaires termine avant la libération du verrou.
Toutes les instances écrivant les mêmes artefacts doivent utiliser le même volume
et le même chemin de verrou. Après un crash, un verrou orphelin nécessite une
intervention : arrêter les producteurs concernés, confirmer qu'aucun ancien
processus ne peut reprendre, examiner les temporaires et la dernière publication,
puis retirer uniquement le verrou concerné avant de réessayer. La sécurité prime
sur une reprise automatique d'un propriétaire dont l'arrêt n'est pas prouvé.

Les chunks WX sont copiés sous un nom temporaire unique dans le répertoire de
l'upload, leur taille est vérifiée et leur contenu synchronisé sur disque avant
publication. Un lien physique vers le nom définitif publie le chunk complet
sans remplacer un chunk concurrent déjà accepté. Le volume des uploads doit
donc prendre en charge les liens physiques entre fichiers d'un même répertoire.
Une erreur de création du lien fait échouer l'envoi ; aucun repli vers une copie
visible partiellement n'est utilisé. Le chemin temporaire est nettoyé après
succès ou échec, sauf s'il existait déjà avant la copie exclusive.
Après un arrêt brutal avant nettoyage, les fichiers de staging ne sont pas
considérés comme des chunks ; ils disparaissent avec l'upload lors de sa purge.
Ces garanties concernent la visibilité atomique et les erreurs d'I/O testées,
pas la persistance complète du système de fichiers après une coupure électrique.

La maintenance ne déduit plus la mort d'un propriétaire distant d'un PID local.
Elle ne supprime pas non plus automatiquement un verrou orphelin : deux
nettoyeurs pourraient lire le même ancien propriétaire, puis le second effacer
le verrou du nouveau propriétaire. La reprise manuelle coordonnée décrite
ci-dessus s'applique donc aussi au verrou de maintenance.
La maintenance acquiert désormais aussi la ligne unique `global` de la table
SQL `admin_maintenance_locks`. Toutes les instances doivent partager cette base.
Ce propriétaire n'expire pas et ne dépend pas de la connexion SQL : un processus
suspendu ne peut pas être remplacé par un autre propriétaire. La libération vérifie
le jeton UUID exact. Ce mécanisme n'est pas un fencing token monotone ; il supprime
le remplacement automatique du propriétaire pour ces commandes externes.

Pour un redémarrage, un build suivi d'un redémarrage ou un déploiement, le propriétaire
est transmis à un processus Node séparé avant la réponse HTTP. Celui-ci vérifie
son jeton, exécute la commande et ne supprime la ligne qu'après sa terminaison.
`systemctl start` attend le job ; `--no-block` n'est pas utilisé. HTTP 202 signifie
acceptation, pas succès du déploiement. Si le processus est interrompu, y compris
par le gestionnaire de services qui arrête tout le groupe, ou si le lancement ou
la libération échoue, la ligne reste verrouillée. Le même principe s'applique
aux commandes synchrones interrompues par timeout ou signal, dont les descendants
pourraient encore fonctionner. Prévoir cette récupération
manuelle dans la procédure de redémarrage ; un processus détaché n'est pas une
garantie de survie à un arrêt de groupe systemd ou à une panne de machine.

Après avoir arrêté et vérifié tous les anciens producteurs et commandes concernés,
inspecter `SELECT lock_name, owner_token, operation, started_at FROM admin_maintenance_locks`.
Supprimer uniquement le propriétaire confirmé orphelin avec
`DELETE FROM admin_maintenance_locks WHERE lock_name = 'global' AND owner_token = ?`.
Ne jamais débloquer uniquement parce que `started_at` est ancien. La migration
inverse refuse de supprimer cette table tant qu'un propriétaire est présent ;
exécuter les retours arrière avec les producteurs arrêtés.

La migration `1790035300000` ajoute la colonne générée `recovery_pending` et
l'index `(recovery_pending, room_id, game_type)`. Le scan paginé ne parcourt plus
toutes les sessions terminées pour évaluer leur JSON. Le coût total reste linéaire
dans le nombre de sessions à récupérer. L'ajout d'une colonne stockée et de son
index peut reconstruire une grosse table : appliquer les deux nouvelles migrations
avant le nouveau backend, dans une fenêtre adaptée au volume réel. Elles ont été
testées sur une base isolée, pas appliquées à la base de l'application ici.

`lila_distributed_lease_losses_total` compte les pertes involontaires, sans labels
de salle, de joueur ou de clé Redis. `LilaDistributedLeaseLost` les signale ; les
libérations normales et l'arrêt du service n'incrémentent pas ce compteur.
Le tableau Grafana `backend-slo.json` présente également la reprise, sa durée,
la quarantaine, la saturation mémoire et les refus de capacité.
Vérifier les règles avec Prometheus 3.5 :

```sh
promtool check rules observability/prometheus/lila-alerts.yml observability/prometheus/lila-slo-rules.yml
promtool test rules observability/prometheus/lila-alerts.test.yml observability/prometheus/lila-slo.test.yml
```

Les fichiers sont prêts à déployer ; leur import Grafana, le chargement Prometheus
et l'acheminement des alertes doivent être vérifiés dans l'environnement cible.

Le job Prometheus qui collecte `/metrics` doit s'appeler `lila-backend`.
`LilaBackendMetricsUnavailable` se déclenche après cinq minutes si au moins une
cible de ce job échoue, ou si le job n'existe plus. L'endpoint exige un JWT
administrateur (`HttpJwtGuard` et `AdminRoleGuard`) : configurer son en-tête
Authorization dans le collecteur et renouveler le jeton avant expiration.
Ne pas désactiver ces gardes pour rendre la collecte accessible.

L'endpoint annonce le type de contenu de son registre Prometheus
(`text/plain; version=0.0.4; charset=utf-8`), et conserve `Cache-Control: no-store`.
Une réponse HTML, même de statut 200 et contenant du texte de métriques, ne valide
pas la collecte. Le test suivant démarre le module Nest d'observabilité réel avec
des clés RSA temporaires et vérifie un échantillon dans un vrai Prometheus :

```sh
PROMETHEUS_BINARY=/chemin/prometheus npm run test:metrics:integration
```

Il vérifie aussi l'échec de collecte avec un jeton invalide ou sans rôle admin,
puis la reprise après remplacement du fichier de credentials. Il utilise
uniquement des ports locaux et supprime ses clés et données temporaires.
Il est exécuté en CI, sans se connecter aux bases ni aux destinataires réels.

Les jauges BullMQ décrivent une file partagée, observée par plusieurs instances.
L'alerte de backlog et le panneau Grafana prennent donc le maximum des observations
par `(queue, state)`, puis additionnent les files et états concernés. Les compteurs
de tentatives échouées restent additionnés : chaque worker compte ses propres
événements. Des files indépendantes doivent conserver des labels `queue` distincts.

Les ratios HTTP/WebSocket utilisent le taux réel de trafic, même inférieur à
une requête par seconde. Une série d'erreurs encore absente vaut zéro lorsqu'une
série de trafic existe ; un trafic nul ne produit pas de division par zéro.
L'augmentation des échecs BullMQ utilise `lila_bullmq_failures_total`, compteur
des tentatives échouées. La jauge `lila_bullmq_jobs{state="failed"}` représente
le stock conservé et ne doit pas être traitée comme un compteur monotone.

Test du circuit complet sur une interface locale uniquement :

```sh
PROMETHEUS_BINARY=/chemin/prometheus ALERTMANAGER_BINARY=/chemin/alertmanager npm run test:observability:integration
```

Le test lance Prometheus 3.5.0 et Alertmanager 0.28.1 sur des ports temporaires,
avec un exporteur et un destinataire webhook de test. Il exige la réception des
12 alertes puis des 12 résolutions. Il copie les règles dans un dossier temporaire,
réduit les fenêtres et délais de renvoi pour ce test, puis arrête les processus
et supprime uniquement ce dossier. Les durées réelles des alertes sont testées
séparément avec `promtool`. Aucun mail ni message externe n'est envoyé.
Ce test est intégré à la CI. Il valide le circuit logiciel local, pas les routes
réseau, les jetons ou les destinataires propres au déploiement réel.
