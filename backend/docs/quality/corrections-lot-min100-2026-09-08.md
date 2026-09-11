# Lot du 8 septembre 2026 : au moins 100 clôtures

155 points examinés individuellement : 118 exigences satisfaites et retirées, 37 examinées mais conservées ouvertes.

Les clôtures comprennent les défauts corrigés dans ce lot et des garanties déjà implémentées, relues et vérifiées par les tests et audits. Elles ne représentent pas autant de nouveaux défauts de code.

Corrections nouvelles : compensation Vault lors du join, préservation après notification échouée, validation du snapshot, masquage des logs JSON et corrélation jeu, limites et nettoyage des processus audio, configuration MySQL commune, libération du runner après échec de connexion, isolation du tour initial, refus des doublons de registres, staging des installateurs et retry borné du renommage Windows.

Contrats et limites : [restauration/publication/logs](../architecture/restoration-publication-and-logging.md), [concurrence/état](../architecture/concurrency-and-state.md), [contenus](../architecture/content-release-pipeline.md).

Validation : 205 suites Jest, 742 tests réussis ; typecheck, lint, build, chargement AppModule compilé, verify:dist (38 manifestes / 42 contenus) et quality:check. Journaux locaux : logs/corrections-min100-jest.log, logs/corrections-min100-final-checks.log et logs/corrections-min100-quality.log. Le premier passage quality:check a demandé la classification du retry Windows ; le passage final valide cette classification. Aucune baseline architecturale ni budget de dette augmenté.

Les tests de stockage distribué utilisent des doubles ; aucune campagne MySQL/Redis/BullMQ réelle, migration ni déploiement effectué.

## Vault

Sources et tests :

- [src/modules/vault/application/services/vault-snapshot.decoder.spec.ts](../../src/modules/vault/application/services/vault-snapshot.decoder.spec.ts)
- [src/modules/vault/application/services/vault-snapshot-restore.compensation.spec.ts](../../src/modules/vault/application/services/vault-snapshot-restore.compensation.spec.ts)
- [src/game/engine/runtime/content/game-state-loader.spec.ts](../../src/game/engine/runtime/content/game-state-loader.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 332 | Auditer le module `vault` comme mécanisme de sauvegarde/restauration. | Audit du flux écriture/décodage/restauration, des ports et de la compensation ; limites de crash consignées. |
| 333 | Définir une version de snapshot explicite. | L'enveloppe Vault impose version = 1 ; toute autre version est rejetée. |
| 334 | Vérifier la compatibilité de restauration avec les versions de moteur/contenu. | Le chargeur compare schemaVersion, contentVersion et rulesVersion aux versions attendues. |
| 335 | Ne pas restaurer aveuglément un objet JSON ancien dans un runtime nouveau. | Aucun ancien JSON n'est injecté sans décodage et contrôle de compatibilité du runtime. |
| 336 | Valider le snapshot avant restauration. | Validation de l'enveloppe, de la date, de la capacité, des identifiants uniques et du state ; cas invalides testés. |
| 337 | Faire échouer proprement une restauration incompatible. | Les incompatibilités produisent une erreur de domaine ; la nouvelle salle est compensée si le jeu refuse la restauration. |
| 338 | Éviter d'écraser une partie courante avec un snapshot incohérent. | La restauration crée une nouvelle salle et ne remplace pas l'état d'une partie courante. |
| 339 | Définir atomicité de la restauration. | Frontière de commit définie ; échecs join/game compensés, notifications après commit sans destruction ; trois scénarios testés. |

## Uploads et publication

Sources et tests :

- [src/modules/sounds/infrastructure/storage/sounds-upload.manager.ts](../../src/modules/sounds/infrastructure/storage/sounds-upload.manager.ts)
- [src/modules/sounds/infrastructure/storage/sounds-audio-process.spec.ts](../../src/modules/sounds/infrastructure/storage/sounds-audio-process.spec.ts)
- [src/modules/sounds/infrastructure/storage/sounds-audio-cleanup.spec.ts](../../src/modules/sounds/infrastructure/storage/sounds-audio-cleanup.spec.ts)
- [src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts](../../src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts)
- [src/modules/update/infrastructure/persistence/wx-update-upload.service.spec.ts](../../src/modules/update/infrastructure/persistence/wx-update-upload.service.spec.ts)
- [src/shared/utils/atomic-file.utils.spec.ts](../../src/shared/utils/atomic-file.utils.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 340 | Auditer les uploads (`sounds`, `wx-update`). | Audit sounds/WX consigné, avec limites MIME, signature de l'installateur et nettoyage restant explicitement ouvertes. |
| 341 | Valider tailles maximales. | Limites HTTP et métier : son 250 Mio entrée/sortie, artefact WX 2 Gio par défaut et taille assemblée exacte. |
| 343 | Neutraliser path traversal. | Clés de sons, IDs d'upload et de release contrôlés ; test de traversée de chemin avant écriture WX. |
| 344 | Générer côté serveur les paths finaux. | Chemins finaux construits par le serveur à partir de clés validées, de versions et d'empreintes. |
| 345 | Interdire noms de fichiers arbitraires dans le filesystem final. | Aucun nom original d'upload ne choisit le nom final d'un son ou artefact WX. |
| 346 | Limiter mémoire utilisée pour upload. | Entrées stockées sur disque, WX assemblé par flux, buffer audio seulement après contrôle de taille, sortie des processus limitée à 1 Mio. |
| 348 | Rendre les opérations de publication atomiques. | Fichiers préparés avant remplacement atomique du manifeste ; copie d'installateur existant passée en staging ; valeur précédente préservée en échec. |
| 349 | Ne jamais exposer un artefact partiellement uploadé comme release valide. | Un installateur partiellement copié reste hors du répertoire public ; test d'interruption et de reprise avec fichiers réels. |
| 350 | Définir checksum/hash des artefacts si mise à jour logicielle. | SHA-256 des archives et installateurs porté par le manifeste WX. |
| 351 | Vérifier l'intégrité avant publication. | Taille, en-tête et SHA-256 attendus vérifiés avant publication ; empreinte recalculée sur les octets reçus. |
| 353 | Séparer stockage upload et activation d'une release. | Répertoires .uploads, .staging et releases distincts ; activation par remplacement du manifeste après préparation. |
| 354 | Pour `sounds`, isoler transcodage et publication. | SoundsUploadManager sépare validateInput, encodeAndValidate et persist ; le manifeste n'est écrit qu'après validation audio. |
| 355 | Appliquer limites CPU/durée au réencodage. | Échéance du transcodage, un thread d'encodage et de filtrage ; arrêt et limite de sortie testés sur sous-processus réels. |

## Logs, métriques et health

Sources et tests :

- [src/platform/observability/application/log-sanitizer.spec.ts](../../src/platform/observability/application/log-sanitizer.spec.ts)
- [src/game/core/infrastructure/logging/game-logger.service.spec.ts](../../src/game/core/infrastructure/logging/game-logger.service.spec.ts)
- [src/platform/observability/infrastructure/metrics/prometheus-metrics.spec.ts](../../src/platform/observability/infrastructure/metrics/prometheus-metrics.spec.ts)
- [src/modules/health/infrastructure/presentation/http/controllers/health.controller.spec.ts](../../src/modules/health/infrastructure/presentation/http/controllers/health.controller.spec.ts)
- [tools/observability-contract-check.cjs](../../tools/observability-contract-check.cjs)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 364 | Normaliser le logging. | Loggers Nest/jeu utilisent le même assainissement ; niveaux et formats contextualisés documentés. |
| 365 | Le `console.error` de bootstrap peut être acceptable ; documenter l'exception. | Exception console.error limitée à l'échec fatal du bootstrap, assainie et documentée. |
| 366 | Le `console.warn` dans `game-logger.service.ts` devrait idéalement passer par le logger standard sauf fallback de bootstrap volontaire. | Le fallback de dossier GameLoggerService passe maintenant par Logger Nest. |
| 367 | Aucun `console.log` métier. | Recherche des sources de production : aucun console.log métier. |
| 368 | Structurer les logs avec contexte. | Logs opérationnels à événements et contexte ; assainissement des objets JSON déjà sérialisés corrigé et testé. |
| 369 | Inclure correlation/request ID. | Correlation ID asynchrone propagé par ServLogger et GameLogger ; test du contexte jeu et refus d'un ID fourni dans le payload. |
| 370 | Inclure room/game/session IDs lorsqu'approprié, sans données sensibles. | Contexte opérationnel room/game/joueur/commande/version ; actions privées masquées par le sanitizer commun. |
| 371 | Définir niveaux log cohérents. | Politique error/warn/info/debug/verbose définie, mapping Nest/Winston existant vérifié. |
| 372 | Éviter de logger des payloads utilisateur complets par défaut. | Clés action/payload/body/content/text/privateData masquées y compris dans les messages JSON sérialisés. |
| 373 | Redacter tokens, passwords, cookies et secrets. | Masquage des tokens, mots de passe, cookies, secrets structurés et credentials d'URL ; tests sans mutation de l'entrée. |
| 375 | Définir une rétention. | Rétention locale explicitée : cinq fichiers de cinq Mio par flux ; distinction avec la conservation temporelle externe. |
| 376 | Rendre les métriques observabilité indépendantes du métier. | Collecteurs Prometheus situés dans la plateforme observability, sans dépendance aux règles des jeux. |
| 377 | Exposer métriques de latence HTTP/WS. | Histogrammes de latence HTTP et WS avec tests des mesures ; routes HTTP paramétrées. |
| 378 | Exposer métriques DB. | Disponibilité DB et ratio de saturation du pool collectés par le contrôle de readiness. |
| 379 | Exposer métriques Redis. | Disponibilité Redis exposée via l'indicateur de dépendance. |
| 380 | Exposer métriques BullMQ. | Nombre de jobs BullMQ par état et disponibilité exposés ; dashboard et règles d'alerte contrôlés. |
| 384 | Définir health checks `liveness` vs `readiness`. | Routes live et ready séparées ; la première mesure l'event loop, la seconde les dépendances. |
| 385 | Une panne DB doit affecter readiness. | Un rejet du ping DB échoue en readiness et publie database=down ; test du contrôleur. |
| 387 | Ne pas rendre le health check dépendant de dizaines d'appels coûteux. | Readiness composée de quatre contrôles définis, sans balayage des rooms, joueurs ou parties. |

## Frontières et audits

Sources et tests :

- [tools/architecture-check.cjs](../../tools/architecture-check.cjs)
- [tools/architecture-check.spec.cjs](../../tools/architecture-check.spec.cjs)
- [tools/game-engine-architecture-check.cjs](../../tools/game-engine-architecture-check.cjs)
- [tools/game-engine-architecture-check.spec.cjs](../../tools/game-engine-architecture-check.spec.cjs)
- [tools/backend-debt-check.cjs](../../tools/backend-debt-check.cjs)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 485 | Créer la même notion de boundary audit pour `modules/**`. | Audit d'architecture couvrant les bounded contexts de modules/** ; fixtures de violations et baseline vide. |
| 486 | Détecter tous les imports inter-module non `public-api`. | Imports intermodules résolus et contrôlés contre public-api, y compris la composition non exemptée. |
| 487 | Détecter tous les imports inter-module d'infrastructure. | Imports profonds d'infrastructure intermodules détectés par l'auditeur de frontières. |
| 488 | Détecter tous les imports inter-module d'entities. | Imports et réexports TypeORM détectés par l'auditeur, avec exceptions de composition explicites. |
| 489 | Détecter les cycles de modules automatiquement. | Cycles de composants/modules détectés, y compris les arêtes de composition des modules ; graphe sans violation. |
| 490 | Détecter les cycles de fichiers importants automatiquement. | Cycles de fichiers du moteur et des jeux couverts par l'audit dédié et ses tests. |
| 491 | Détecter les dépendances domain -> application/infrastructure. | Règles de couches interdisant domain vers application/infrastructure ; audit sans violation. |
| 492 | Détecter application -> présentation. | Règles de couches empêchant application vers présentation/infrastructure hors exceptions contractuelles. |
| 493 | Détecter les imports plateforme indésirables dans domain. | Imports Nest, TypeORM, validation et infrastructure indésirables du domaine détectés par les règles d'architecture. |
| 494 | Fixer des budgets d'architecture plutôt que seulement LOC. | Contrats d'architecture versionnés et budgets de violations séparés des budgets LOC ; baseline non augmentée. |
| 495 | Par exemple zéro import infrastructure depuis domain/application hors adapters autorisés. | Budget de violations des imports de couches à zéro, avec adapters et exceptions explicitement décrits dans le contrat. |
| 498 | Zéro cycle de bounded contexts. | Audit du graphe des bounded contexts sans cycle ; baseline vide conservée. |
| 499 | Zéro dépendance profonde inter-module. | Audit sans import profond intermodule non autorisé, y compris câblage Nest. |
| 503 | Zéro accès direct à `process.env` hors config/bootstrap autorisé. | Recherche de production : process.env limité à platform/config/runtime-environment et environment-validation. |
| 504 | Zéro `Math.random()` dans le backend métier. | Recherche de production : aucun Math.random dans le métier. |
| 505 | Zéro `console.log` hors bootstrap/fallback explicitement approuvé. | Recherche de production : aucun console.log ; exception d'erreur de bootstrap documentée séparément. |
| 506 | Zéro `any` intentionnel en production sans justification exceptionnelle. | Audit AST de production : aucun any explicite, budget zéro conservé. |
| 507 | Zéro suppression TypeScript silencieuse. | Recherche de production : aucune directive ts-ignore, ts-nocheck ou ts-expect-error silencieuse. |

## Atomicité des commandes

Sources et tests :

- [src/game/core/application/services/game-command-executor.service.spec.ts](../../src/game/core/application/services/game-command-executor.service.spec.ts)
- [src/game/core/application/services/game-engine.service.spec.ts](../../src/game/core/application/services/game-engine.service.spec.ts)
- [src/game/testing/architecture-tests/game/backend-debt-contracts.spec.ts](../../src/game/testing/architecture-tests/game/backend-debt-contracts.spec.ts)
- [src/game/engine/runtime/declarative-game.runtime.spec.ts](../../src/game/engine/runtime/declarative-game.runtime.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 573 | Faire échouer une action non autorisée avant mutation. | Autorisations et validateAction évalués avant applyActions sur copie ; rejet sans mutation de l'état source. |
| 574 | Toutes les mutations doivent être atomiques du point de vue du moteur. | Exécution par copie et commit CAS ; le moteur ne publie que l'état validé résultant. |
| 575 | Aucune mutation partielle si une règle échoue en milieu d'exécution. | Test d'un batch dont la seconde action échoue : état initial strictement conservé. |
| 576 | Si le runtime fonctionne par copie/transaction d'état, conserver cette garantie partout. | Même garantie au chargement et à l'initialisation : clones profonds, y compris le tour fourni désormais copié. |
| 577 | Sinon introduire une notion de transaction/command execution atomique. | Transaction logique de commande déjà assurée par l'exécuteur sur copie et le commit versionné ; pas de chemin mutable alternatif. |
| 578 | Séparer validation pure et exécution lorsque cela simplifie l'atomicité. | Méthodes validateActor/validateAction séparées de applyActions ; validation de chaque action contre le résultat précédent testée. |
| 579 | Ne pas déclencher d'I/O pendant une mutation déterministe avant commit. | Règles et effets déterministes en mémoire ; accès I/O des jeux interdits par l'audit auteur. |
| 580 | Collecter les side effects puis les exécuter après commit logique lorsque possible. | Événements accumulés dans l'état, persistés avec le commit puis diffusés ; aucun événement publié pour un CAS rejeté. |
| 581 | Définir l'ordre des effects. | Ordre de file des effets et priorités des règles automatiques documentés et contrôlés par les tests runtime. |
| 582 | Définir ce qui se passe lorsqu'un effect échoue. | Échec d'effet ou débordement : rejet de la commande sur copie et trace ; aucun commit partiel, politique documentée. |
| 584 | Ne pas rejouer une mutation métier entière arbitrairement après timeout sans idempotency key. | Pas de retry arbitraire d'une mutation après timeout ; identité/reçu de commande et version employés, fenêtre de 256 reçus explicitée. |

## Concurrence et synchronisation

Sources et tests :

- [src/game/core/application/services/game-room-command-queue.service.spec.ts](../../src/game/core/application/services/game-room-command-queue.service.spec.ts)
- [src/game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service.spec.ts](../../src/game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service.spec.ts)
- [src/game/core/application/services/game-engine.service.spec.ts](../../src/game/core/application/services/game-engine.service.spec.ts)
- [src/game/core/infrastructure/presentation/ws/state/game-ws-realtime-state.service.spec.ts](../../src/game/core/infrastructure/presentation/ws/state/game-ws-realtime-state.service.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 591 | Formaliser concurrence sur une partie. | Responsabilités queue locale, verrou MySQL de room et CAS distinguées dans le contrat de concurrence. |
| 592 | Une seule commande à la fois par game/room si le moteur suppose une sérialisation. | Queue par room et port de verrou distribué ; tests de sérialisation locale et de deux queues partageant le verrou. |
| 594 | Définir timeout de lock. | Acquisition GET_LOCK bornée par GAME_ROOM_LOCK_TIMEOUT_SECONDS, validé de 1 à 30 secondes ; refus fermé et testés. |
| 598 | Ne pas utiliser un mutex process-local pour une garantie distribuée. | Production câblée sur MysqlGameRoomLockService ; la queue locale n'est pas présentée comme une garantie distribuée. |
| 599 | Formaliser optimistic concurrency/version du state si pertinent. | État versionné et port compareAndSet ; conflit explicite sur version attendue non courante. |
| 600 | Refuser d'écraser un state plus récent avec un state ancien. | Tests d'un commit périmé et du nettoyage d'un ancien run : l'état récent n'est pas écrasé/supprimé. |
| 601 | Définir une stratégie de conflict handling. | Conflit remonté, relecture et nouvelle décision sur version courante ; absence de rejeu aveugle documentée. |
| 602 | Garantir que projections/read models correspondent à une version du state. | Presenter construit une projection d'un état unique avec son run et sa version. |
| 604 | Inclure version/sequence dans les state updates temps réel. | Mises à jour WS portent roomId, runId et version. |
| 605 | Permettre au client de détecter les messages hors ordre. | Le couple runId/version permet au client d'identifier messages obsolètes et changements de partie. |
| 606 | Prévoir resync complet. | Résolution/relecture d'état complet et projection par viewer disponibles à la reconnexion ; tests de run actuel et périmé. |
| 607 | Ne pas supposer qu'un delta arrivera toujours. | Synchronisation fondée sur un état complet ; la reconstruction ne dépend pas de la réception de chaque delta. |

## Projections et confidentialité

Sources et tests :

- [src/game/engine/runtime/projection/declarative-game-queries.ts](../../src/game/engine/runtime/projection/declarative-game-queries.ts)
- [src/game/engine/runtime/projection/game-system-view.spec.ts](../../src/game/engine/runtime/projection/game-system-view.spec.ts)
- [src/game/engine/runtime/projection/game-kit-view.spec.ts](../../src/game/engine/runtime/projection/game-kit-view.spec.ts)
- [src/game/core/infrastructure/presentation/ws/state/game-ws-state.presenter.spec.ts](../../src/game/core/infrastructure/presentation/ws/state/game-ws-state.presenter.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 608 | Clarifier la visibilité des informations de jeu. | Contrat de visibilité public/propriétaire/spectateur et événements privés porté par les kits/projections. |
| 609 | La projection publique doit être la seule voie permettant de générer l'état envoyé à un joueur. | Chemin WS passe par exposeStateForUser puis le presenter ; état interne réservé aux ports de persistance/restauration. |
| 610 | Ne jamais exposer le state interne complet puis retirer quelques propriétés. | La projection runtime construit system/kits/game/actions/pending ; elle ne transmet pas l'état complet pour l'amputer ensuite. |
| 611 | Construire une projection whitelistée. | Projection système et kits à champs explicites, avec tests d'absence d'internals et d'événements internes. |
| 612 | Faire dépendre la projection de l'identité/role du viewer. | Viewer résolu depuis l'identité ; spectateur représenté par null ; actions et informations privées filtrées. |
| 613 | Masquer hands/decks/secrets de manière générique lorsque le kit le sait. | Mains, zones cachées et événements privés filtrés dans les kits partagés, tests propriétaire/autres joueurs/spectateur. |
| 614 | Ne pas réimplémenter la confidentialité des cartes jeu par jeu. | Confidentialité des cartes détenue par les kits cards/visibility, pas recodée dans les présentateurs des jeux. |
| 615 | Vérifier que debug snapshot n'est jamais exposé en production à un client normal. | Inspection des routes de jeu et tests de projection : pas de debug snapshot moteur envoyé au joueur normal. |
| 616 | Isoler clairement les APIs debug. | Exports internes distincts de PlayerView ; instrumentation de test dans game/testing, sans endpoint joueur de debug state. |

## Registre et versions

Sources et tests :

- [src/game/composition/game-module-discovery.spec.ts](../../src/game/composition/game-module-discovery.spec.ts)
- [src/game/core/application/services/game-registry.service.spec.ts](../../src/game/core/application/services/game-registry.service.spec.ts)
- [src/game/engine/runtime/content/external-content-release.spec.ts](../../src/game/engine/runtime/content/external-content-release.spec.ts)
- [src/game/engine/runtime/content/game-state-loader.spec.ts](../../src/game/engine/runtime/content/game-state-loader.spec.ts)
- [tools/game-engine-architecture-check.cjs](../../tools/game-engine-architecture-check.cjs)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 619 | Définir un contrat de catalog de jeux. | Contrats GameCatalogReader, GameCatalogDefinition et GameRuntimeDescriptor explicites ; projection du catalogue testée. |
| 621 | Un jeu ne doit pas s'enregistrer lui-même dans un global registry. | Les jeux exportent leur définition ; aucun auto-enregistrement dans un singleton global. |
| 622 | Éviter les imports avec side-effects pour enregistrer des jeux. | Imports statiques de définitions, pas d'effet secondaire d'enregistrement des jeux. |
| 623 | Favoriser une liste/registry explicite construite au composition root. | Registry générée explicitement au composition root et lue par discoverGameDefinitions. |
| 624 | Valider l'unicité des game IDs. | Doublons de définitions refusés ; registre runtime désormais protégé contre remplacement d'une instance par une autre. |
| 625 | Valider l'unicité des manifests. | Doublons de codes de manifestes contrôlés dans l'audit et désormais refusés à la lecture du catalogue. |
| 629 | Versionner clairement une release de jeu. | Versions de schéma, règles et contenu explicites ; manifeste de contenu exposé dans le descripteur runtime. |
| 630 | Définir si une modification du contenu change la version de jeu, content version ou les deux. | Contenu versionné séparément des règles ; modification du contenu change contentVersion, contrat documenté. |
| 631 | Définir les règles de compatibilité avec parties existantes. | Compatibilité stricte des trois versions au chargement ; conversions incompatibles uniquement hors ligne, tests de chaque mismatch. |
| 634 | Auditer `external-content-release.ts` avec cette cible. | Audit external-content-release : manifeste, confinement, intégrité, parsing et cache ; activation/rollback à compléter identifiés. |
| 635 | Définir intégrité/checksum du contenu externe. | Contenu externe vérifié par SHA-256 exact et contentVersion associée ; tests d'altération et de chemin sortant. |

## État et collections

Sources et tests :

- [src/game/engine/runtime/state/declarative-state.factory.spec.ts](../../src/game/engine/runtime/state/declarative-state.factory.spec.ts)
- [src/game/engine/runtime/content/game-content.spec.ts](../../src/game/engine/runtime/content/game-content.spec.ts)
- [src/game/engine/runtime/content/game-state-loader.spec.ts](../../src/game/engine/runtime/content/game-state-loader.spec.ts)
- [src/game/engine/runtime/kits/ranking-kit.spec.ts](../../src/game/engine/runtime/kits/ranking-kit.spec.ts)
- [src/game/testing/architecture-tests/game/backend-debt-contracts.spec.ts](../../src/game/testing/architecture-tests/game/backend-debt-contracts.spec.ts)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 697 | Geler réellement les définitions immuables lorsqu'utile. | Définitions compilées et contenus profondément gelés, tests de compilation unique et de catalogues imbriqués. |
| 698 | Ne pas muter le contenu statique pendant une partie. | Contenu module-owned gelé pour les règles et composants ; contrats des jeux et catalogue partagé immuable vérifiés. |
| 699 | Ne pas partager un objet de state mutable entre deux rooms. | Test de deux initialisations à partir des mêmes entrées : mutations des joueurs, métadonnées, tour et reçus isolées. |
| 701 | Cloner/initialiser explicitement le state runtime. | Initialisation explicite des kits et clone profond de l'état de base et du tour. |
| 702 | Éviter les shallow copies si elles permettent fuite de mutation imbriquée. | Référence partagée du tour supprimée ; test de mutation de sa collection imbriquée sans effet sur la source ou l'autre room. |
| 703 | Définir ownership des collections mutables. | Collections de session possédées par la room, contenu partagé gelé ; audit AST d'ownership des états des jeux. |
| 704 | Préférer readonly sur definitions/content. | Contrats readonly de définition/contenu et tableaux de catalogue readonly, renforcés par gel à l'exécution. |
| 706 | Normaliser les collections : Map/Set vs objets sérialisables. | Convention explicite : objets/tableaux sérialisables dans l'état ; Map/Set réservés au contenu statique. |
| 707 | Ne pas persister directement structures non sérialisables. | Chargeur refuse Map, Set, fonctions, symboles, bigint, NaN/Infinity, cycles et accesseurs avant clonage ; tests dédiés. |
| 708 | Centraliser encode/decode si Map/Set nécessaires runtime. | Aucun Map/Set accepté dans l'état persisté ; pas d'encode/decode ad hoc nécessaire, rejet central plutôt que conversions dispersées. |
| 715 | Utiliser tie-breaker explicite pour ranking. | Classement avec critères ordonnés et tie-breaker numérique playerId ; égalités de rang testées. |
| 716 | Ne jamais dépendre d'un hasard implicite pour départager. | Permutation de l'ordre d'entrée sans changement du classement ; aucun hasard dans le départage. |

## Configuration MySQL

Sources et tests :

- [src/platform/database/mysql-connection-options.spec.ts](../../src/platform/database/mysql-connection-options.spec.ts)
- [src/platform/database/database-options.factory.ts](../../src/platform/database/database-options.factory.ts)
- [src/data-source.ts](../../src/data-source.ts)
- [src/platform/config/environment-validation.spec.ts](../../src/platform/config/environment-validation.spec.ts)
- [.env.example](../../.env.example)

| Point | Exigence | Résolution et portée |
| --- | --- | --- |
| 445 | Clarifier la responsabilité de `data-source.ts` vs configuration Nest. | data-source.ts compose la CLI/migrations ; Nest ajoute injection d'entités et retries de démarrage, sur le même socle de connexion. |
| 446 | Centraliser les paramètres DB. | Paramètres MySQL communs centralisés dans createMysqlConnectionOptions, avec tests de valeurs par défaut et surcharges. |
| 447 | Ne pas dupliquer parsing d'environnement DB. | Parsing connexion/port/pool/timeout partagé entre CLI et serveur ; test d'équivalence des options. |
| 449 | Définir pool de connexions explicitement pour production. | Pool explicitement configuré par DB_POOL_SIZE, défaut 10, entier de 1 à 1000 ; documenté dans .env.example. |
| 450 | Définir stratégie de retry au démarrage séparément des erreurs en cours d'exécution. | Retries de connexion au démarrage Nest bornés et séparés des erreurs de requêtes/mutations ; configuration documentée et testée. |

## Points examinés restant ouverts

| Point | Travail restant / raison de conservation |
| --- | --- |
| 342 | Les signatures d'en-têtes ZIP/PE et ffprobe ne prouvent pas la structure complète de tous les formats ; fallback WAV à approfondir. |
| 347 | Nettoyage transcodage corrigé ; certaines erreurs précoces de chunks et interruptions du processus exigent encore une récupération. |
| 352 | La signature WX v2 couvre l'archive principale, pas l'empreinte de l'installateur ; évolution de contrat nécessaire. |
| 356 | Durée et sortie de chaque outil bornées ; concurrence globale et quota CPU serveur non imposés. |
| 374 | Masquage structuré renforcé ; les PII dans tous les textes métier libres ne sont pas encore inventoriées. |
| 381 | Aucune jauge Prometheus exhaustive du nombre de parties actives. |
| 382 | Pas de métrique moteur par gameId/code avec preuve de cardinalité bornée. |
| 383 | Les échecs de restauration/snapshot sont signalés mais n'ont pas leur compteur Prometheus dédié. |
| 386 | L'indicateur choisit un Redis prioritaire ; il faut couvrir les capacités indispensables lorsqu'elles utilisent plusieurs URL. |
| 448 | Timeout de connexion ajouté ; timeout général des requêtes SQL non défini. |
| 593 | Contrats du verrou testés avec doubles ; campagne MySQL/BullMQ réelle autour des mutations encore requise. |
| 595 | Libération à la fermeture de connexion prévue par la primitive ; panne du holder et connexions de pool à tester réellement. |
| 596 | Pas d'API multi-room dédiée ; preuve exhaustive d'absence de prise imbriquée de verrous non établie. |
| 597 | Ordre contractuel d'acquisition de plusieurs rooms non implémenté. |
| 603 | Le serveur fournit runId/version ; filtrage monotone dans tous les clients hors de la validation de ce lot. |
| 617 | Séparation des exports internes vérifiée ; revue exhaustive environnement + autorisation de toutes les routes admin/debug non terminée. |
| 618 | Projection publique vérifiée ; examen exhaustif de tous les artefacts compilés sensibles non terminé. |
| 620 | Discovery runtime dans composition vérifiée ; lecture filesystem des catalogues reste une autre voie de découverte à clarifier. |
| 626 | Cohérence des IDs vérifiée ; titres et bornes de joueurs ont encore des sources multiples. |
| 627 | Titres et min/maxPlayers existent dans manifest, definition et overrides. |
| 628 | Priorités de lecture existantes mais pas de dérivation complète depuis un propriétaire unique. |
| 632 | Les versions incompatibles sont rejetées ; leur définition ancienne n'est pas conservée pour continuer toutes les parties après redéploiement. |
| 633 | Versions persistées et comparées, mais pas de catalogue multi-version de runtimes conservés pour les parties actives. |
| 636 | Publication nouvelle validée ; activation d'une release existante/rollback doit aussi revalider son intégrité et son schéma. |
| 637 | Bascule par lien atomique conçue pour Unix ; remplacement et récupération du lien sous Windows non validés. |
| 695 | Caches techniques de module et singletons d'observabilité existent ; inventaire complet de leur mutabilité à finir. |
| 696 | Même limite : pas de preuve globale d'absence de tout état mutable module-level. |
| 700 | Isolation du state initial testée ; références persistantes de tous les caches applicatifs non couvertes. |
| 705 | Le gel couvre les APIs usuelles ; mutateurs de prototype Map/Set restent un contournement à examiner. |
| 709 | Hash embarqué trie les clés avec localeCompare dépendant de la locale ; changer sa canonicalisation nécessite une stratégie de compatibilité. |
| 710 | Ordres moteur testés ; ordre des clés dans tous les flux externes et toutes les locales non garanti. |
| 711 | Classement testé ; tous les tris métier et lectures DB ne sont pas inventoriés. |
| 714 | Ordre effets/règles et projections testé ; preuve exhaustive de tous les ordres joueurs/cartes conservée ouverte. |
| 717 | Versions de règles présentes, sans politique complète d'évolution de chaque algorithme déterministe. |
| 718 | Conversion incompatible hors ligne indiquée ; migrations effectives de parties lors d'un bug moteur à définir. |
| 719 | Critères opérationnels de distinction bugfix rétrocompatible/modification de règles non formalisés. |
| 720 | Snapshots portent versions schéma/règles/contenu ; version globale des algorithmes moteur à relier au point 717. |
