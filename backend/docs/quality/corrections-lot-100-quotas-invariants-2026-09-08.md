# Lot suivant de 100 — avancement du 8 septembre 2026

**79 clôtures sur les 100 visées. Le lot reste incomplet.**
Le fichier de travail passe de 303 à 224 points. Les identifiants retirés
sont exactement : 14, 15, 25, 27, 36, 37, 39, 58, 63, 64, 65, 113, 114, 115, 117, 118, 123, 129, 131, 156, 158, 159, 161, 162, 164, 230, 231, 233, 234, 276, 277, 278, 281, 293, 347, 358, 381, 382, 383, 388, 389, 390, 391, 392, 393, 394,
407, 409, 411, 413, 429, 453, 454, 459, 501, 557, 558, 561, 562, 563, 567, 569, 593, 595, 596, 597, 620, 626, 627, 628, 644, 645, 646, 647, 648, 649, 650, 685, 688.

| Point | Correction et preuve |
| --- | --- |
| 685 | Contrats Reader et projections revus ; garde contre les écritures. [Preuves](corrections-reader-responsibilities-2026-09-09.md). |
| 688 | Décisions sans lecture du temps ni callback de service ; requêtes et configuration renommées. [Preuves](corrections-policy-responsibilities-2026-09-09.md). |
| 129 | Extensions persistées et publiques identifiées par schéma, règles et contenu ; compatibilité vérifiée. [Preuves](corrections-game-extension-versions-2026-09-09.md). |
| 648–650 | Préparation interne au runtime, jeux confinés au SDK, aucune option de performance ajoutée aux règles. [Preuves](corrections-engine-optimization-boundary-2026-09-09.md). |
| 293 | Double cast du pilote SQL remplacé par validation ; interdiction AST dans le lint de production. [Preuves](corrections-double-casts-2026-09-09.md). |
| 39 | Contrats sortis des règles, rôle auteur explicite et garde AST. [Preuves](corrections-rule-contracts-2026-09-09.md). |
| 161–162 | Seconde stabilisation sans effet supplémentaire et non-convergence refusée sans mutation ; campagne validée. [Preuves](corrections-automatic-idempotence-2026-09-09.md). |
| 164 | Ordre des hooks/timers et transitions refusées vérifiés dans le runtime. [Preuves](corrections-lifecycle-transitions-2026-09-09.md). |
| 347 | Nettoyages indépendants des temporaires et conservation des erreurs d'origine. [Preuves](corrections-temporary-cleanup-2026-09-09.md). |
| 123 | Absence de catalogues copiés dans les sauvegardes des jeux, garde et tests négatifs. [Preuves](corrections-content-storage-2026-09-09.md). |
| 65 | Signatures et dépendances de l'API auteur verrouillées et versionnées. [Preuves](corrections-sdk-contract-2026-09-09.md). |
| 63–64, 131 | Contrats structurels sans stockage privé ni orchestration du runtime. [Preuves](corrections-author-context-2026-09-09.md). |
| 37 | Comportements sortis de game.ts, callbacks typés et composition contrôlée. [Preuves](corrections-game-composition-2026-09-09.md). |
| 113–115, 117–118 | Aucun stockage parallèle des pioches, mains, positions, scores ou tours programmés dans les 38 jeux. [Preuves](corrections-game-state-ownership-2026-09-09.md). |
| 36 | Contrats indépendants des chargeurs et contrôle transitif du sens des imports. [Preuves](corrections-game-dependency-direction-2026-09-09.md). |
| 14 | Déclaration unique des 38 catalogues, schémas communs aux exports/releases, règles alimentées par les données déclarées et six modèles générés compilés. [Preuves](corrections-content-authoring-2026-09-08.md). |
| 15 | Suppression des lecteurs locaux et du lecteur SDK ; onze catalogues normalisés, 22 sources remplacées, six compatibilités exactes vérifiées. [Preuves](corrections-content-sources-2026-09-08.md). |
| 25, 27, 429, 501 | Identifiants Sac, réponses de quiz structurées et garde-fou contre les interpréteurs de prose. [Preuves](corrections-text-content-2026-09-09.md). |
| 593, 595–597 | Portée de commande interdisant les acquisitions imbriquées et vérification MySQL réelle de contention, libération après perte du propriétaire et récupération. [Preuves](corrections-room-locks-2026-09-09.md). |
| 644–646 | Schémas préparés une fois, options et parseurs capturés, mesure avant/après avec résultats identiques et sans nouveau cache global. [Preuves](corrections-schema-compilation-2026-09-09.md). |
| 230–231 | Planification automatique, transport WS et persistance des sessions séparés des orchestrateurs ; providers et tests vérifiés. [Preuves](corrections-service-boundaries-2026-09-09.md). |
| 647 | Profil CPU V8 reproductible, charge et limites documentées, copies et validation identifiées comme coûts principaux. [Preuves](corrections-runtime-profiling-2026-09-09.md). |
| 569 | Validation commune des dés, paramètres persistés, contrôles des résultats par joueur et bornes avant tirage. [Preuves](corrections-dice-validity-2026-09-09.md). |
| 233 | Diffusion aux sockets isolée, projection de roster pure, vues par client sans mutation du payload source. [Preuves](corrections-room-state-2026-09-09.md). |
| 58 | Replay réel des 38 jeux, quatre graines par jeu, 7 087 commandes comparées et snapshots JSON ; corrections de clocks, choix, cartes, dés et boucles. [Preuves](corrections-replay-campaigns-2026-09-09.md). |
| 234 | Décodage des intentions et routage séparés du pipeline quota/corrélation/ACK ; anciennes délégations supprimées. [Preuves](corrections-room-command-2026-09-09.md). |
| 620 | Index des packages produit par la composition ; suppression du parcours récursif du lecteur, résolution depuis le package compilé et contrôle hors cwd projet. [Preuves](corrections-game-discovery-2026-09-08.md). |
| 626–628 | Métadonnées canoniques importées par les 38 jeux, validation manifeste/runtime, limites administratives bornées et packages générés complets. [Preuves](corrections-manifests-2026-09-08.md). |
| 156, 158, 159, 281, 358, 381–383, 453, 454, 459 | Graphes de phases, validation de configuration, publication atomique du verrou de maintenance, métriques et extraction des utilitaires techniques de shared. [Preuves détaillées](corrections-observability-config-platform-2026-09-08.md). |
| 276–278 | Identité de restauration persistée, versions de schéma/contenu/règles dans les tâches, contrôle au CAS automatique, nettoyage sans suppression des générations récentes, décodage et remise en attente des livraisons anticipées. [Preuves détaillées](corrections-tasks-2026-09-08.md). |
| 388–394 | Arrêt ordonné HTTP/WS/BullMQ puis DB/Redis, drainage des mutations et des déconnexions, lots parallèles attendus même après erreur. [Preuves](corrections-shutdown-2026-09-09.md). |
| 407 | Service WS commun, même stockage Redis atomique que HTTP, configuration et réponses de refus documentées. |
| 409 | Les commandes chat Room et les messages Presence traversent le quota avant traitement ; test de refus sans dispatch. Les routes API bénéficient du même intercepteur de messages. |
| 411 | Les commandes Game du registre API et les commandes coûteuses Room passent par le quota partagé ; refus avant replay, ack ou dispatch. |
| 413 | Suppression du compteur par connexion API. Clé utilisateur stable entre sockets et instances, comptage Redis atomique, refus en cas de panne ; tests avec deux services partageant un stockage simulé. |
| 557, 558, 561 | Parsings stricts aux frontières, JWT cohérents et grands entiers MySQL conservés exactement. [Preuves](corrections-numeric-boundaries-2026-09-09.md). |
| 562 | Contrat explicite : ressources/compteurs signés et finis, dépenses non négatives, transferts entiers positifs, résultats bornés. |
| 563 | Invariants portés par les contrôleurs génériques et la validation de playerValues dans les sessions, avec tests de restauration et de refus sans mutation. |
| 567 | Modification des scores par GameScoreController avec valeurs et deltas bornés ; aucune écriture directe scores/resources/counters trouvée dans les règles des 38 jeux, hors tests. |

Contrat détaillé : [ws-quotas-and-numeric-invariants.md](../architecture/ws-quotas-and-numeric-invariants.md).

## Corrections supplémentaires sans clôture globale

Les [uploads audio](corrections-sound-media-2026-09-09.md) vérifient maintenant
MIME, conteneur réel et flux audio. Le point 342 reste ouvert pour les archives WX.

Les quantités d'inventaire, charges de dés, distances de mouvement et prix de
marché ont été bornés. Les achats/ventes vérifient capacité, débordement de solde
et ajustement avant mutation. Les points 559–560, 565, 568 restent présents :
leurs exigences couvrent davantage de chemins que les opérations corrigées.

La revue initiale des tâches obsolètes (276–278) a été suivie des corrections
détaillées dans corrections-tasks-2026-09-08.md ; ces trois points sont clôturés.
Le verrou de maintenance est désormais publié atomiquement (358), et les
métriques requises sont présentes (381–383). Les points 357 et 359–363 restent
ouverts : récupération après crash, exclusion distribuée et commandes détachées.
Le passage des audits automatiques n'atteste pas ces exigences.

## Validation

Schémas : **246 suites / 1 050 tests réussis**, typage, lint, build/AppModule,
quality:check, verify:dist et contrôle du diff réussis.


Arrêt : **245 suites / 1 045 tests réussis**, typage, lint, build/AppModule,
quality:check, verify:dist et contrôle du diff réussis.


Numérique : **238 suites / 1 032 tests réussis**, typage, build/AppModule, lint,
quality:check et précision BIGINT sur MySQL isolé vérifiés.


Verrous : 5 suites / 40 tests ciblés, typage, build/AppModule, lint et quality:check
réussis ; vérification des verrous et des 39 migrations sur MySQL isolé réussie.


Texte/contenu : **233 suites / 921 tests réussis** ; typage, lint, compilation et
chargement AppModule, quality:check, verify:dist et comparaison des catalogues
réussis. Huit tests de compatibilité relancés après correction d’un type de test.


Découverte : 3 suites / 13 tests ciblés, typage, lint, build/AppModule,
quality:check, verify:dist et lecture des 38 packages compilés hors cwd projet
réussis.


Manifestes : **230 suites / 887 tests réussis**, typage, lint, build/AppModule,
quality:check, verify:dist et contrôle du diff réussis.


Sources de contenu : **229 suites / 877 tests réussis**, lint, typecheck,
build/AppModule, quality:check, verify:dist (38 manifestes, 80 JSON) et contrôle
du diff réussis. Les tests du lecteur supprimé sont retirés ; quatre tests de
compatibilité de sauvegarde sont ajoutés.


Catalogues : **230 suites / 885 tests réussis**, puis 4 suites / 33 tests après
extraction des déclarations ; lint, typecheck, build/AppModule, verify:dist et
quality:check réussis. Le contrat SDK passe explicitement en version 4.0 ;
aucun seuil de dette augmenté.


Dernière série (phases, configuration et infrastructure) : **227 suites /
850 tests réussis**, typage, lint, compilation/chargement AppModule, verify:dist,
quality:check et contrôle du diff réussis. Voir le rapport dédié pour la portée
et les limites des tests.

Série précédente (tâches) : **219 suites / 812 tests réussis**, typage, lint,
compilation/chargement AppModule, verify:dist et quality:check réussis.
Les dépendances SQL/BullMQ sont simulées dans ces tests. Voir le rapport dédié.

Première série du lot (quotas et invariants) :

- Jest complet : **216 suites, 788 tests réussis**.
- Typecheck complet, compilation et chargement de l'AppModule compilé réussis.
- Lint, quality:check et verify:dist réussis sans augmentation des seuils.
- Après la dernière extraction de visibilité : 3 suites / 54 tests ciblés réussis.
  Journaux : `logs/corrections-next100-*.log`.
- Tests ciblés de quota, décodeurs et kits ; refus sans état ni événement modifié.
- Aucun serveur Redis ne répondait sur 127.0.0.1:6379 : aucun test d'intégration
  Redis réel exécuté. Le partage et la panne sont testés avec un stockage simulé ;
  le contrat de réponse du script Redis est testé séparément.
- Aucun déploiement, changement de baseline ou migration de données.

Le prochain travail doit poursuivre les 45 clôtures restantes de ce lot ;
ce rapport ne présente pas cinquante-cinq corrections comme cent points terminés.
