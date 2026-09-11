# Corrections du 8 septembre 2026 — observabilité, configuration et infrastructure

Cette passe porte sur les 293 exigences effectivement présentes au début de la
reprise, malgré le nombre de 193 indiqué dans la demande. Elle ne constitue pas
une attestation de clôture de l'ensemble du backlog.

## Exigences vérifiées

| Point | Correction et preuve |
| --- | --- |
| 156, 158, 159 | Graphe déclaré par `transitions`/`next`, phases terminales explicites, refus des phases inaccessibles et des phases sans sortie. Contrôle des sorties au runtime avant mutation. Migration des graphes spécifiques et des compositions génériques ; tests des 38 jeux, des cycles inaccessibles, des sorties inconnues et du refus sans mutation. Voir [game-phase-graphs.md](../architecture/game-phase-graphs.md). |
| 281 | Inventaire des lectures de configuration dans les sources et de RuntimeEnvironmentKey ; ajout des 18 variables manquantes au schéma de démarrage et à `.env.example`. Contraintes numériques, protocoles Redis, noms de services et cohérence des limites de biographie. Tests d'inventaire, de configuration invalide et d'égalité entre schéma et exemple. |
| 358 | Le verrou de maintenance est écrit dans un fichier temporaire exclusif, synchronisé puis publié par lien physique atomique sans remplacement. Les concurrents voient un document complet ou un conflit. Nettoyage du temporaire et fermeture du descripteur en cas d'erreur. Tests sur le filesystem local, concurrence, métadonnées et libération après rejet asynchrone. |
| 381 | `lila_game_active_sessions` compte les sessions SQL started/playing/paused, toutes instances confondues, sans charger leurs états. Requête plafonnée à une seconde. En cas de panne, absence d'échantillon et `lila_game_active_sessions_collection_up=0`, sans faux zéro de parties. |
| 382 | `lila_game_errors_total{game,code,operation}` expose les erreurs de commande, commit, restauration, snapshot et replay. Les registres de labels sont plafonnés à 128 jeux et 64 codes, plus les valeurs de repli. Aucun identifiant de joueur/room ni message d'exception dans les labels. Tests avec 2 000 valeurs distinctes. Le registre interne GameEngineMetrics est aussi borné. |
| 383 | Les chemins publics de restauration/export/replay du moteur et de sauvegarde/restauration Vault enregistrent les échecs tout en propageant l'erreur initiale. Vault utilise des codes fixes et le jeu `unknown` si l'identité n'est pas encore fiable. |
| 453, 454, 459 | Déplacement des utilitaires filesystem, crypto, journalisation et présentation vers les capacités platform correspondantes. Les API publiques et leurs consommateurs sont migrés. Shared conserve uniquement les primitives pures de texte, erreur, version et date. Plus d'I/O de journalisation lors de l'import de playing-logger. |

## Corrections supplémentaires, exigences globales encore ouvertes

Le validateur de démarrage construit ses diagnostics à partir des noms de clés
du schéma et des codes Joi. Il ne propage ni message Joi contenant une valeur,
ni contexte/cause conservant les secrets. Un test inspecte aussi la pile et les
propriétés masquées. Le point 284 reste ouvert pour la revue de tous les autres
chemins de journalisation.

Le verrou MySQL détruit la connexion lorsqu'une acquisition n'est pas confirmée
ou lorsque RELEASE_LOCK échoue/ne confirme pas la libération. Il ne remet donc
pas dans le pool une connexion susceptible de retenir un verrou. L'adaptateur
valide les réponses SQL et préserve le résultat d'une commande déjà validée.
Les tests simulent la réponse perdue, les résultats malformés et les erreurs de
commande ; les points de garantie après crash restent ouverts sans exercice SQL réel.

Les diffusions administrateur et invalidations de catalogue parcourent les IDs
par lots de 100, en ordre croissant et sous une borne maximale capturée au début.
Elles attendent la fin des envois d'un lot avant de lire le suivant. La limite
globale de 100 000 destinataires, qui tronquait silencieusement les diffusions,
est supprimée. Les autres collections restent à revoir pour les exigences
globales de pagination et de charge.

La récupération après crash des verrous fichier, l'exclusion entre serveurs et
le suivi des commandes de maintenance détachées restent ouverts (359–363).
Le verrou fichier nécessite un filesystem supportant les liens physiques ;
l'échec de cette primitive refuse l'opération, sans mode dégradé non exclusif.

## Contrat des métriques

Le nombre de parties provient de la base partagée : utiliser `max` entre les
instances, pas `sum`. La métrique `collection_up` indique le résultat de la
dernière collecte terminée. Les erreurs comptent les échecs par couche/opération,
et non les incidents uniques : un même incident peut être observé par le moteur
et par Vault. L'opération et le code permettent de distinguer ces observations.

Les nouveaux répertoires `platform/filesystem`, `platform/security` et
`platform/serialization` sont enregistrés dans le contrat d'architecture.
Le lecteur SQL de sessions actives est explicitement inscrit comme adaptateur
MySQL dans l'audit de persistance. Aucune baseline de dette n'est augmentée.

## Validation

Validation finale : **227 suites, 850 tests réussis** ; typage complet, lint,
compilation, chargement de l'AppModule compilé, verify:dist, quality:check et
vérification des espaces du diff réussis. Les onze identifiants clôturés sont
retirés du fichier de travail : **282 exigences restent ouvertes**.

Suite complète avant les graphes de phases : 226 suites, 843 tests réussis.
Après ajout des graphes : 66 suites ciblées moteur/jeux/architecture, 279 tests
réussis. Après ajout du parcours administrateur : 28 suites ciblées, 106 tests réussis. Les derniers
contrôles de typage, lint, compilation et qualité sont consignés dans
`logs/corrections-remaining-*.log`.

Aucun déploiement, redémarrage, lancement de maintenance ou changement de données
de production. Les tests SQL/Redis/BullMQ utilisent des dépendances simulées ;
les tests du verrou fichier utilisent un répertoire temporaire local.
