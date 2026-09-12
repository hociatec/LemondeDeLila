# Traitement du snapshot JSON de 134 points

## Concurrence réelle et temps technique

Les points **64, 65 et 66 sont terminés**. La politique est queue locale,
verrou MySQL par room sur connexion dédiée, puis CAS transactionnel comme
autorité. Les commandes humaines et les rafraîchissements de roster/date
transmettent désormais l'identité de restauration, comme l'automatisation.
Le nettoyage conditionnel vérifie lui aussi cette identité sous verrou SQL.
Une ancienne exécution ne peut écraser ni effacer une restauration réutilisant
la même version numérique. Le défaut de restitution de connexion préserve le
résultat métier, détruit la connexion et émet un log d'erreur.

Preuves : `logs/json134-lock-cleanup.log` (13 tests),
`logs/json134-restore-epoch.log` (trois suites, 19 tests),
`logs/json134-locks-real-isolated.log` (MySQL réel : contention, rooms distinctes,
connexion propriétaire perdue, erreur métier, libération et reprise),
`logs/json134-mysql-migrations-compatibility.log` (40 migrations, transactions,
un seul gagnant entre deux CAS concurrents, restauration et suppression stale).
Ces tests utilisent une instance MySQL isolée sur le port 33317 ; ses bases
temporaires sont supprimées par le harness et le serveur est arrêté ensuite.

Deux défauts empêchaient la campagne réelle : le nom explicite de la migration
historique `ImportLegacySettingsJson` avait un suffixe à dix chiffres, rejeté
par TypeORM ; la migration `DecoupleUserForeignKeys` introspectait des colonnes
générées sans métadonnées TypeORM puis tentait de rétablir une colonne absente.
Le nom est corrigé (réexécution sans mutation, testée avec l'ancien ledger) et
les clés étrangères sont lues nativement dans information_schema, avec contrôle
d'existence des colonnes au rollback. L'audit de layout contrôle le suffixe.
Le point 104 reste ouvert pour l'étude de toutes les migrations lourdes.

Le point **76 est terminé** : mesures d'exécution/verrou et heartbeat utilisent
une horloge monotone, séparée de l'horloge métier. Les tests du heartbeat
avancent et reculent l'horloge civile d'un jour sans fausser sa durée
(`logs/json134-heartbeat-clock.log`, quatre tests avec le nettoyage existant).
Les échéances Unix, timestamps d'observabilité et durée virtuelle du simulateur
restent distingués des performances dans `docs/architecture/business-clock.md`.
Compilation et chargement AppModule réussis dans
`logs/json134-concurrency-migrations-build.log`.

## Invariants Cards/Ownership et frontières publiques

Le point **116 est terminé** : les kits portent les contrôles des cartes,
destinataires, catalogues, familles, cycles et propriétaires. Les conteneurs
restaurés malformés ou étrangers sont rejetés ; les lectures ne modifient pas
les mains/familles. Le recyclage refuse une pioche non vide, la complétion
respecte les occurrences physiques et les transferts refusés ne consomment
pas la source. Les identifiants de propriété dangereux pour les objets JS
sont refusés. La validation transversale exhaustive d'une session demeure
suivie au point 32. Preuves : `logs/json134-cards-ownership-regressions.json`
(136 suites, 1 040 tests), `logs/json134-cards-ownership-build.log` et
`logs/json134-cards-ownership-lint.log`.

Le point **52 est terminé** : audit des exports directs et transitifs de User,
Messaging, Social, Bot, Presence et Room. Ils offrent des services, capacités
ou lecteurs spécialisés, sans repository public. Le dernier contrat portant
ce nom dans Notification était un lecteur d'amis à une méthode ; il est
renommé `NotificationFriendsReader`, avec son token et ses consommateurs.
La règle `business-api-repository-export` interdit désormais les réexports
directs, les alias et les barrels vers un fichier de repository. Le contrôle
`reader-read-only` s'applique au lecteur renommé.

Le point **54 est terminé** après vérification de la séparation existante :
les entrées métier n'exposent aucune déclaration d'infrastructure, même via
alias ou namespace ; les imports `composition-api.ts` sont réservés à la
composition. Les modules Nest sont câblés par les entrées de composition.
Les tests de cette séparation et du nouvel interdit de repositories passent
dans `logs/json134-public-repositories-architecture.log`. L'audit complet de
1 366 fichiers et 71 composants ne rapporte aucune violation dans
`logs/json134-public-repositories-audit.log`.

Les sept suites Notification et câblage (17 tests) passent dans
`logs/json134-notification-reader.log` ; compilation et chargement AppModule
réussis dans `logs/json134-public-readers-build.log`. Les points 51 et 53
restent ouverts : ces vérifications ne concluent pas à la minimalité de
toutes les capacités ni à l'absence de règles métier dupliquées.

## Sélections, initialisation et projection privée

Le point **72 est terminé** : la projection moteur construit explicitement
les sections publiques, les six extensions de vues des jeux déclarent leurs
champs, et le présentateur WS reçoit la projection filtrée par
`GameVisibilityService`. Le dernier clone suivi d'une suppression de secret,
dans les données de choix, est remplacé par une liste positive de huit champs.
Un test injecte un nouveau secret interne et une action forgée ; ni le joueur
destinataire, ni un autre joueur, ni le spectateur ne les reçoivent. Les tests
existants vérifient aussi l'absence du state moteur et des secrets des jeux.
Les enrichissements de présentation travaillent sur cette vue déjà construite.

Avancées non clôturées : `selectCards` fournit les sources deck/hand/discard,
filtres par identifiants, occurrences distinctes, bornes, propriétaires voisins,
timeout persistant, manque de cartes explicite et effets après transfert.
Les timeouts des choix multiples retournent maintenant des listes valides.
Le SDK est versionné 6.9.0 et son diff de déclarations a été revu avant mise à
jour de la référence. Le JSON expose l'attribution standard des pions et
refuse les modes invalides, répétitions et distributions insuffisantes.

Les cartes contrôlent leurs conteneurs avant normalisation, les identités de
joueurs, cycles de pioche et familles restaurées. Les lectures de familles ne
créent aucun état et renvoient des copies ; une famille demandant deux copies
ne consomme plus une carte unique avant d'échouer. L'adaptateur de publication
Room, pure transmission, est supprimé au profit d'un alias Nest du bus existant.
Les points 5, 10, 11, 17, 32, 56 et 108 restent ouverts pour leur périmètre
complet ; ces avancées ne constituent pas une migration des jeux complexes.

Preuves : `logs/json134-selection-setup-cards.json` (136 suites, 1 028 tests),
`logs/json134-choice-projection.log` (six suites, 32 tests),
`logs/json134-selection-setup-quality.log` (chaîne qualité complète),
`logs/json134-selection-setup-build.log` (typage sans erreur, compilation et
chargement de l'AppModule). Le contrôle structurel reste sans dette nouvelle.

## Lot invariants, nettoyage et suivi des jeux

Nettoyage préalable : 61 dossiers vides supprimés dans l'espace projet,
avec vérification des fichiers cachés et suppression non récursive de chaque
dossier vide. Les dépendances, sorties de compilation, métadonnées Git et liens
n'ont pas été parcourus.

Les identités numériques sont contrôlées dans les ressources, scores,
inventaires, propriétaires, déplacements et transferts de cartes. Les bots
gardent leurs identifiants négatifs. Les lectures d'inventaire renvoient des
copies et ne créent plus de possessions. Les transferts refusés n'ajoutent pas
de destinataire vide et ne débitent pas leur source. Les états restaurés
d'inventaire, propriété et marché rejettent les registres étrangers, contenus
malformés et prix manquants. Les agrégats économiques refusent les dépassements.

La distribution de cartes contrôle tous les destinataires et la quantité avant
de piocher ; jeu/défausse refusent une pioche différente de celle de la main.
Les mélanges de mains refusent les participants dupliqués. Les pioches inconnues
ne sont plus créées implicitement par une opération. Score délègue son classement
à Ranking, qui applique les mêmes limites numériques et un départage par ID.
Ces changements renforcent aussi 12, 32 et 116, conservés ouverts pour leur
périmètre restant, notamment les validations exhaustives de restauration Cards.

Le rapport de métriques distingue désormais lignes TypeScript/JSON et jeu
entièrement JSON. Toute croissance des règles est signalée, dès la première
ligne ; un retour au TypeScript après une migration JSON fait échouer le
contrôle. La comparaison courante signale 26 revues de croissance par rapport
à la référence historique : elles ne sont ni masquées ni assimilées à des
migrations terminées. Les conditions de livraison d'un nouveau jeu et d'une
nouvelle primitive sont précisées dans `authoring-and-boundaries.md`.

Preuves de ce lot : `logs/json134-invariants-final.json` contient 133 suites et
981 tests réussis (runtime, services, jeux et parités historiques).
`logs/json134-invariants-build.log` confirme le typage sans erreur, la compilation
de 1693 fichiers et le chargement de l'AppModule. Le lint des kits/cartes et la
chaîne qualité complète sont consignés dans les logs `json134-invariants-*-final`.
Le format de snapshot et la surface publique SDK restent inchangés. Aucun seuil
ni baseline n'est relevé ; la surveillance de croissance des règles est durcie.

## Lot demandé : les vingt premiers points restants

Périmètre fixé au début de cette passe : 1, 2, 3, 4, 5, 6, 7, 8, 10,
11, 12, 13, 17, 18, 24, 30, 32, 35, 36 et 37.
Seuls 18 et 37 sont clôturés dans cette passe ; les dix-huit autres restent
ouverts. La migration de tous les jeux et le stress-test d'un jeu complexe
ne sont pas achevés et aucun nouveau jeu n'est déclaré migré ici.

Pour 17, le compilateur refuse désormais les plateaux dont les pions ne
suffisent pas à servir le nombre maximal de joueurs. Pour 35, les snapshots
refusent les sous-classes de Date et d'Array ainsi que les faux prototypes
dont le constructeur se nomme Object. Le contrôle n'appelle pas leurs
accesseurs ou méthodes de sérialisation ; les conteneurs natifs provenant
d'un autre contexte JavaScript restent acceptés. Ces corrections ne valent
pas clôture exhaustive des points 17, 32 ou 35.

Validation : `logs/json134-first20-regressions.json` contient 91 suites et
821 tests réussis. Après les derniers ajouts aux tests de conditions et de
disponibilité, `logs/json134-first20-final.json` contient quatre suites et
136 tests réussis. La chaîne qualité complète passe dans
`logs/json134-first20-quality.log` ; le typage et le lint des fichiers
modifiés sont également vérifiés. Aucun seuil ni baseline n'est relevé.

Le périmètre original est conservé dans `snapshot-json-134-2026-09-11.txt`.
Les numéros des rapports antérieurs désignent d'autres exigences et ne prouvent
pas la clôture de ce snapshot. `corriger.txt` et le registre associé contiennent
les exigences qui restent ouvertes.

## Corrections appliquées

| Points         | Réalisation                                                                                                                                                                                                                                                                                                                                                                                                                                       | Preuves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 114            | Invariants de ressources centralisés : valeurs signées finies et bornées, identifiants de joueurs valides, dépenses positives, transferts prévalidés et agrégats économiques bornés. Les catalogues de prix restaurés doivent être complets et connus.                                                                                                                                                                                            | `numeric-invariants.spec.ts`, `economy-kit.spec.ts`, achats/ventes/transferts refusés sans changement ; campagne finale de 981 tests.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 115            | Invariants Inventory centralisés : quantités entières bornées, identifiants d'objets sûrs, catalogue et propriétaire valides, transferts/échanges prévalidés. Les lectures sont détachées et sans mutation ; les registres restaurés étrangers sont refusés.                                                                                                                                                                                      | `inventory-kit.spec.ts`, `numeric-invariants.spec.ts`, parités Panier et tests des jeux utilisateurs dans la campagne finale.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 117            | Invariants Movement centralisés : pistes référencées, distances entières bornées, positions dans la piste, règles de dépassement et identités sûres. Les lectures d'une piste inconnue sont refusées ; les clés restaurées doivent être canoniques.                                                                                                                                                                                               | `movement-kit.spec.ts`, `numeric-invariants.spec.ts`, tests des programmes JSON, jeux et parités historiques.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 118            | Score utilise désormais Ranking au lieu de son propre algorithme. Les valeurs sont finies et bornées, participants uniques et directions explicites ; égalités de rang et ordre par identifiant sont cohérents, bots compris.                                                                                                                                                                                                                     | `ranking-kit.spec.ts`, `numeric-invariants.spec.ts` et tests des jeux dans la campagne finale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 119            | Definition of Done d'un nouveau jeu précisée : JSON pour les mécaniques existantes, SDK pour une extension justifiée, zéro infrastructure/état générique miroir, contenu validé/versionné et contrôles de livraison.                                                                                                                                                                                                                              | `docs/architecture/authoring-and-boundaries.md`, audits de frontières, grammaire, métriques, contrats et build. Cette exigence de livraison ne clôture pas la migration des jeux historiques.                                                                                                                                                                                                                                                                                                                                                                    |
| 120            | Definition of Done d'une primitive : usages équivalents réels ou caractère fondamental, cohérence union/schéma/références/capabilities/compilateur/exécuteur, atomicité, tests de restauration/visibilité/déterminisme et revue des versions.                                                                                                                                                                                                     | Checklist explicite dans `authoring-and-boundaries.md` ; tables exhaustives de capabilities et contrôles SDK/architecture.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 122            | Suivi par jeu des lignes TypeScript et JSON, indicateur JSON-only, signalement de toute croissance des règles et échec en cas de retour du TypeScript dans un jeu migré. L'ancien ratio est explicitement distingué d'une preuve de migration.                                                                                                                                                                                                    | `tools/game-metrics-report.spec.cjs`, rapport v2 sur les 39 jeux ; comparaison historique sans actualisation de baseline et exécution dans quality:check.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 18             | Vérification des capabilities de la grammaire JSON actuelle : les effets, conditions, réactions et programmes exigent leurs composants et ressources avant installation du runtime. La sélection de pions d'un plateau vérifie désormais aussi la capacité pour le nombre maximal de joueurs et le nombre de pions par joueur.                                                                                                                    | `json-capabilities.spec.ts` couvre les 17 instructions dépendant de composants/ressources, directement et dans trois continuations, les six conditions dépendantes et les deux disponibilités de réaction. Les tables typées obligent à classifier toute nouvelle variante de l'IR. Tests des programmes board/grid/judged/event-race dans la campagne de 91 suites.                                                                                                                                                                                             |
| 37             | Audit des sélecteurs aléatoires : random-player, random-opponent, départages leader/last et players.randomOther utilisent le RNG injecté ; les sélections de cartes, inventaires, bots et timeouts passent également par ce RNG.                                                                                                                                                                                                                  | `json-player-selectors.spec.ts` vérifie le replay exact, la consommation d'un tirage sauvegardé, l'absence de mutation de l'état source et l'absence d'appel à Math.random. Inventaire des appels aléatoires dans engine/runtime et games ; garde d'architecture sur les APIs d'infrastructure des jeux.                                                                                                                                                                                                                                                         |
| 61, 62, 63     | Vérification du chemin unique BullMQ métier : identités de commandes stables, commits CAS, rejet des anciennes générations, runs et identités de restauration. Les tâches d'une partie supprimée ou terminée sont désormais écartées avant la recherche de son ancien runtime. La planification est reconstruite depuis les sessions persistées après perte d'écriture Redis ou restauration ; un ancien job ne peut pas modifier le nouvel état. | Sept suites et 42 tests dans `logs/json134-stale-tasks.json`, dont doublons de workers, échec du diffuseur après commit, changement de restoreId à version égale, CAS SQL sans écriture en cas de conflit, récupération périodique et nettoyage sur reset/suppression. Inventaire des constructions Worker/Queue dans `src`, contrôle des identités dans le store SQL et chaîne qualité complète réussie. Les pannes réelles DB/Redis ne sont pas injectées dans cette passe ; les scénarios sont couverts par les tests unitaires des frontières et des stores. |
| 113            | Les conversions de dates persistées refusent les valeurs invalides ou retournent explicitement `null` aux frontières optionnelles, sans substitution par l'heure courante. Le parseur des instants explicites refuse désormais également les dates calendaires impossibles et les heures normalisées par JavaScript ; le coffre de sauvegardes utilise ce parseur.                                                                                | Inventaire des appels `Date.parse`, `new Date` et `toISOString` dans `src` ; tests `date-serialization`, `vault-snapshot.decoder` et `wx-update-release.service`. `logs/json134-json-fidelity.json` : trois suites, 35 tests réussis avant ajout du test supplémentaire d'accesseur de prototype. Les présentations historiques utilisant l'époque zéro ne substituent pas l'heure courante ; l'harmonisation de ces présentations reste au point 112.                                                                                                           |
| 31             | Mécanisme explicite de migration des snapshots moteur : graphe versionné, résolution complète du chemin avant transformation, exécution sur clone, protection de l'identité du contenu et refus sans migration compatible.                                                                                                                                                                                                                        | `engine-snapshot-migrations.spec.ts` et `game-state-loader.spec.ts`, réexécutés dans `logs/json134-restoration-followup.json` (huit suites, 97 tests réussis). La politique de refus 1 → 2 est documentée dans `engine-snapshot-migrations.md`. Le point demande le mécanisme ; la conservation des anciens runtimes et contenus reste dans le point 30.                                                                                                                                                                                                         |
| 14, 15, 16     | Panier compose cinq fichiers JSON de contenu depuis un `game.json` de 202 lignes. Les références `$content` sont résolues par une fonction pure avant compilation. Le générateur fournit les imports statiques. Chemins, pointeurs, cycles, liens et expansion sont bornés et validés.                                                                                                                                                            | Comparaison exacte de la définition résolue avec le document antérieur ; tests du résolveur et du générateur ; trois traces historiques de Panier ; documentation `json-game-authoring.md`.                                                                                                                                                                                                                                                                                                                                                                      |
| 9              | Sélecteurs partagés : précédent, tirage parmi les actifs, premier et dernier au score. Départage obligatoire pour les classements, ordre des voisins explicite. Conservation des sélecteurs existants.                                                                                                                                                                                                                                            | `json-player-selectors.spec.ts` : exécution après compilation JSON, scores négatifs, égalités, ordre inversé, replay du RNG et rejets de variantes invalides.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20             | Union canonique de conditions complétée par les comparaisons de score, ressources et quantités d'inventaire, ainsi que la propriété. Références vérifiées avant démarrage. `has-card` reconnaît les objets de carte identifiés.                                                                                                                                                                                                                   | `json-conditions.spec.ts` : 26 tests, dont restauration JSON, six comparateurs, composition logique et références invalides.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 46, 47         | La CI exécute désormais toute la chaîne qualité, dont les tests anti-cycle et les frontières des paquets de jeux. Aucun seuil ni baseline n'est relevé.                                                                                                                                                                                                                                                                                           | Workflow `backend-architecture.yml`, `architecture:test`, `architecture:check`, `game-engine:audit:test`, `game-engine:audit` ; chaîne qualité réussie.                                                                                                                                                                                                                                                                                                                                                                                                          |
| 48             | Les modèles, records et repositories sont refusés dans `contracts/`, y compris les sous-dossiers. Le cas négatif d'un repository imbriqué est ajouté aux tests du garde-fou.                                                                                                                                                                                                                                                                      | `architecture-check.spec.cjs`, `application-contract-placement-audit.cjs`, exécutés dans le workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 49, 50         | La CI impose les frontières des API métier, y compris les réexports indirects d'infrastructure, et l'indépendance des couches basses du moteur.                                                                                                                                                                                                                                                                                                   | Tests et audit d'architecture, audit moteur et `runtime:separation:audit` réussis ; commandes présentes dans le workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 19, 21         | Effets et cibles partagent les unions discriminées et schémas fermés du moteur. L'échange aléatoire de cartes utilise le composant Cards existant et les cibles canoniques.                                                                                                                                                                                                                                                                       | `effect-json-schema.spec.ts`, `json-player-selectors.spec.ts`, `json-card-exchanges.spec.ts` ; références et champs invalides refusés, échange et replay vérifiés.                                                                                                                                                                                                                                                                                                                                                                                               |
| 22, 23         | Le langage JSON accepte des données et recettes métier fermées. Aucun interpréteur, callback, import, variable ou boucle auteur ; un effet personnalisé non enregistré est refusé.                                                                                                                                                                                                                                                                | `json-program-boundary.spec.ts` : 13 cas de compilation, refus sans exécution des accesseurs et callbacks, texte descriptif inerte ; politique dans `json-game-authoring.md`.                                                                                                                                                                                                                                                                                                                                                                                    |
| 25, 26, 27     | Politique explicite pour grammaire, règles, catalogues et algorithmes. Refus des versions inconnues ; réorganisation de fichiers sans changement du document résolu compatible. L'algorithme passe en version 2 pour la sémantique corrigée de `has-card`.                                                                                                                                                                                        | `json-version-policy.spec.ts`, politiques `json-game-authoring.md` et `engine-snapshot-migrations.md`. Les snapshots moteur 1 exigent leur ancien runtime ; aucune migration équivalente n'est prétendue.                                                                                                                                                                                                                                                                                                                                                        |
| 28, 29         | Les snapshots vérifient version des règles, identité et empreinte du contenu avant exécution. L'empreinte du document JSON résolu détecte aussi les règles ou catalogues modifiés sans incrément d'étiquette auteur.                                                                                                                                                                                                                              | `json-version-policy.spec.ts` : 11 tests ; règles, contenu réordonné, quatre en-têtes incompatibles et ancienne version moteur refusés sans mutation. Tests de migrations de contenu et moteur également réussis.                                                                                                                                                                                                                                                                                                                                                |
| 33, 34         | Définitions et contenus compilés immuables. Le résultat de `setup` est maintenant validé puis cloné avant l'entrée de phase : une fonction auteur retournant le même objet ne partage plus ce state entre parties.                                                                                                                                                                                                                                | Tests `compilation-contracts`, `game-content`, `setup-state-isolation` et contrats des 39 jeux. Le nouveau test d'isolation échouait avant correction.                                                                                                                                                                                                                                                                                                                                                                                                           |
| 39, 40         | Identités des composants, patterns, règles automatiques et catalogues contrôlées à compilation ; graphe de phases accessible, références connues, sorties ou terminal explicite. Les copies d'une même carte scalaire dans une pioche restent distinctes d'un doublon de définition de catalogue.                                                                                                                                                 | `compilation-contracts`, `component-reference-validation`, `game-phase-graph-validator`, schémas JSON des programmes et contrats du catalogue.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 41, 42, 43, 44 | Stabilisation bornée à 32 étapes et résolution bornée à 256 effets. Travail sur clone, événements collectés en mémoire puis commit de session. Effets dans l'ordre de la queue, branches conditionnelles insérées en tête, règles automatiques triées par priorité puis ordre déclaré.                                                                                                                                                            | `automatic-stabilization`, `json-game-compiler`, runtime et command executor ; tests des priorités dans `compilation-contracts`, audits de séparation du runtime et d'architecture.                                                                                                                                                                                                                                                                                                                                                                              |
| 87             | Redaction récursive des logs et des messages de framework ; correction des variantes `api_key`, `api-key`, `client_secret` et des valeurs citées contenant des espaces.                                                                                                                                                                                                                                                                           | `log-sanitizer` et `log-sanitizer-credentials` ; nouvelles régressions reproduites avant correction.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 88, 89         | Cardinalité des labels bornée sur la durée de vie du registre ; routes live et ready distinctes, dépendances DB/Redis/BullMQ/stockage réservées à ready.                                                                                                                                                                                                                                                                                          | Tests Prometheus, métriques moteur, contrôleur health et indicateurs de dépendances dans la passe complète courante.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 92, 93, 94     | Quotas HTTP/WS sur stockage Redis partagé, refus si indisponible ; rotation atomique et révocation des refresh tokens ; configuration production refusant secrets génériques et paramètres permissifs.                                                                                                                                                                                                                                            | Tests `redis-rate-limit.storage`, `ws-request-rate-limit`, `rate-limit-options.factory`, `redis-refresh-token`, `user-authentication`, `environment-validation` et audit sécurité.                                                                                                                                                                                                                                                                                                                                                                               |
| 97, 99         | Repositories ORM cantonnés à l'infrastructure ; 26 entités enregistrées une fois au composition root, une entité propriétaire par table physique.                                                                                                                                                                                                                                                                                                 | Audits architecture/persistance et `app/database/typeorm-entities.spec.ts`, inventaire `table-ownership.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 102, 103       | Migrations autonomes des modules métier et historique contrôlé par empreintes SHA-256 normalisées pour les fins de ligne. Aucune migration publiée n'a été modifiée.                                                                                                                                                                                                                                                                              | `migrations.contract.spec.ts`, `migration-history.spec.ts`, registre `tools/migration-history.json`, réussis dans la passe complète.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 106            | `shared` contient uniquement interfaces transversales et utilitaires techniques ; toutes les nouvelles mécaniques de cette passe sont dans le moteur.                                                                                                                                                                                                                                                                                             | Inventaire courant de `src/shared`, audits architecture/moteur ; aucune mécanique de jeu ajoutée à `shared`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Vérifications enregistrées

- `logs/json134-modules-selectors-tests.json` : huit suites, 126 tests réussis.
- Tests du générateur et des audits moteur : 37 réussites.
- Tests de gouvernance du backlog : six réussites, dont le format multiligne CRLF.
- ESLint sur les fichiers modifiés : `logs/json134-eslint.log`.
- Avant la migration de Morpion : 311 suites, 1 638 tests réussis dans
  `logs/json134-full-tests.json`.
- Après migration de Morpion : cinq suites, 120 tests réussis, incluant les
  contrats de tous les jeux, les contenus canoniques, la grille rectangulaire,
  le match nul et les traces historiques : `logs/json134-grid-tests.json`.
- Chaîne qualité complète réussie : `logs/json134-quality.log`.
- Vérifications versionnement, conditions et parités : sept suites, 65 tests
  réussis dans `logs/json134-version-tests.json`, puis 11 tests de politique
  de versions réussis après ajout du cas de catalogue réordonné.
- Compilation production et chargement de l'AppModule compilé réussis.
- Après les cinq migrations JSON présentes au catalogue : **321 suites et
  1 736 tests réussis**, `logs/json134-full-current.json`.
- Après correction de l'isolation, de la restauration et des logs : huit suites,
  61 tests réussis, `logs/json134-core-regressions.json`. Les cinq suites de
  `logs/json134-catalog-tests.log` vérifient également les 39 contrats de jeu,
  Dame Nature et Olympia avec leurs catalogues acceptés explicites.

La restauration valide désormais aussi l'en-tête de contrôle, les invariants de
session et les kits avant une commande ou projection, y compris sans action.
Le composant Cards refuse les identifiants inconnus. Un catalogue accepté séparé
de la pile initiale exprime les ajouts de Dame Nature et les échanges d'Olympia.
Le point 32 reste ouvert : la validation exhaustive des continuations et du state
auteur doit encore être complétée.

Morpion est migré en JSON, avec ses pions séparés et ses règles en version 2.
Absurdissimes est également migré en JSON, en version de règles 2. Les trois
parties de référence conservent exactement leurs événements métier ; les tests
vérifient les mains privées, les références, les phases, les actions invalides
sans mutation et le refus explicite d'une ancienne version de règles.
Le programme partagé couvre les soumissions cachées, leur révélation, le vote
du juge, la rotation, le renouvellement des mains et le score de victoire.
Le point 1 reste ouvert tant que tous les autres jeux ne sont pas migrés.

Aventure Sauvage est migré en JSON, règles version 3, avec trois fichiers de
contenu et une recette partagée de course à événements. Les trois traces métier
sont identiques jusqu'à la victoire. Les tests couvrent les références de piste,
dés, pions, pioche, phases et victoire, ainsi que le refus d'anciennes règles.
Le catalogue compte désormais cinq jeux JSON sur 39 ; 34 migrations restent à
faire dans le point 1. `logs/json134-event-race-tests.json` consigne les tests
de cette migration et les contrats du catalogue.

Les vingt cartes spéciales de Gérard disposent désormais chacune d'une trace
historique et d'un contrôle de replay. La sélection de « Main fantôme » exclut
les joueurs qui ne participent pas à la session de soumission, notamment le
juge. Un test vérifie le refus sans mutation ni événement d'une cible interdite.
Cette correction ne constitue pas encore la migration JSON du jeu complexe.

La validation globale et les autres migrations sont en cours. Ce document ne
constitue pas une déclaration de fin des 134 points.

La passe suivante renforce la validation des effets restaurés : version de la
continuation, indicateurs booléens, cohérence du choix actif et références des
instructions de la queue, des réactions et de leurs fallbacks. Les mêmes index
de composants servent à la compilation et à la restauration. Les tests de
corruption vérifient le refus avant commande et projection, sans mutation.
Le point 32 reste ouvert pour la validation exhaustive des autres continuations
et du state auteur.

La sérialisabilité refuse aussi les tableaux creux, les entrées `undefined` de
tableaux, les propriétés supplémentaires de tableaux et les propriétés non
énumérables. Le codec historique du timestamp de room refuse les personnalisations
de Date. Les accesseurs propres et celui du constructeur du prototype ne sont
jamais exécutés. Le point 35 reste ouvert pour la passe exhaustive des snapshots.

Vérifications finales de cette passe : `logs/json134-restoration-followup.json`
contient huit suites et 97 tests réussis. La passe complète initiale a exécuté
325 suites (323 réussies, deux en échec avec quatre tests) avant correction de
la lecture de `pending.data.choiceId`. Le test runtime concerné passe dans les
97 tests ciblés ; les trois campagnes concernées passent dans
`logs/json134-replay-followup.json` (37 autres campagnes non relancées).
Les 12 tests Cards, Dame Nature et Olympia passent également. Le contrat SDK
est revu et versionné en 6.7 pour l'ajout optionnel `cards.deck.catalog` ; sa
référence est actualisée sans changement des signatures auteur existantes.

La chaîne `quality:check` complète et le build avec chargement de l'AppModule
compilé passent (`logs/json134-followup-quality.log` et
`logs/json134-followup-build.log`). Un test complémentaire a reproduit puis
corrigé le refus d'une cible bot dans une continuation : les identifiants de
joueur sont des entiers sûrs non nuls, positifs pour les humains et négatifs
pour les bots. Les trois suites de restauration, sélecteurs et références
passent, soit 54 tests dans `logs/json134-bot-restoration.json`.

La poursuite suivante ajoute une empreinte persistante des commandes : même
identifiant et même contenu donnent une relance sans mutation ; un autre contenu,
acteur, type d'action ou timer est rejeté. Les empreintes ne conservent pas le
contenu privé en clair, utilisent un ordre canonique des clés et préservent
l'ordre des tableaux. Les anciens reçus restent chargeables mais leur relance
invérifiable est refusée. Cette évolution optionnelle est documentée dans le
contrat SDK 6.8 et dans la politique des snapshots. Le point 69 reste ouvert :
le cache de réponses WS doit encore être partagé entre les instances.

Le validateur d'effets restaurés contrôle désormais les identifiants de joueurs
dans tous les rôles directs, les conditions et les disponibilités de réaction.
Il réutilise les mêmes contrôles que le contenu statique, enrichis du roster de
la session ; les données opaques des effets personnalisés restent validées par
leur propre schéma. Le point 32 reste ouvert pour son périmètre exhaustif.

Le traitement d'une tâche obsolète vérifie désormais l'existence et la fin de
la partie avant de chercher son ancien runtime. Les deux cas, reproduits en
échec avant correction, passent sans exécution ni écriture. L'inventaire de
`src` confirme une seule queue BullMQ métier, `game-engine-tasks` ; l'autre
construction de Queue est son indicateur de santé.

Preuves de cette poursuite :

- `logs/json134-stale-tasks.json` : sept suites, 42 tests sur les générations,
  réinitialisations, identités de restauration, CAS, doublons, échec après commit,
  récupération de la planification, stockage SQL et suppression de room.
- `logs/json134-command-engine-regressions.json` : 90 suites, 745 tests sur le
  moteur, les services de jeu et les parités historiques avant la réorganisation
  finale des validations.
- `logs/json134-command-restoration.json` : six suites, 76 tests après cette
  réorganisation ; les huit tests dédiés à l'idempotence sont inclus.
- Contrôles structurels sans dette nouvelle ; aucun seuil ni baseline relevé.
- `logs/json134-idempotency-quality.log` : chaîne qualité complète réussie.
  Compilation et chargement de l'AppModule compilé réussis dans
  `logs/json134-idempotency-build.log` ; typage et lint revérifiés après la
  réorganisation finale. Les points 61, 62 et 63 sont retirés du backlog.

## Conditions de victoire déclaratives — point 7

Arrivée sur piste, seuil de score ou ressource, dernier joueur actif et nombre de manches sont déclarables en JSON. Les classements de fin de manches acceptent plusieurs critères ordonnés ; les égalités ont une politique explicite. Les références sont validées avant démarrage. Les effets start-round, end-round et eliminate-player sont génériques ; une fin de manche répétée rejette l'action sans mutation partielle.

Validation : logs/json134-standard-victory-regressions.json (137 suites, 1 053 tests), typage, compilation et chargement AppModule, lint et chaîne quality:check réussis. Contrat SDK 6.10.0 revu : seul effect-ir.ts change en plus du numéro de version. Point 7 retiré après validation.

## Releases conservées et relations ORM — points 85 et 100

La publication WX conserve toutes les releases publiées : un ancien manifeste côté client reste une référence valide. Seul le staging est nettoyé. Test de lecture de l'ancienne archive après publication et retry ; 11 suites et 45 tests upload/audio réussis (logs/json134-upload-release-regressions.json), lint, typage et quality:check réussis (logs/json134-upload-quality.log).

Audit des 16 décorateurs de relations ORM : seules Room.participants et Room.bots sont des collections inverses. Elles servent aux jointures explicites du lobby et du repository Room, et aux projections des participants/bots ; aucune relation inverse inutilisée à supprimer. Construction des métadonnées de toutes les entités, cascades et mappers vérifiés : 4 suites, 6 tests (logs/json134-orm-relations.json).

Poursuite du point 81, conservé ouvert : noms temporaires audio par UUID ; deux processus simultanés, seize attentes maximum et expiration configurable bornée à 120 secondes. Test de saturation, expiration et récupération sans timer restant. Le registre des timers classe explicitement ce nouveau délai technique d'admission ; aucun seuil structurel relevé.

## Contenu, intégrité, atomicité et composition — points 55, 82, 83 et 84

Les deux surfaces multipart sont les sons administrateur et les chunks WX. Les sons sont examinés par ffprobe/ffmpeg avec format, piste audio, durée, transcodage et silence contrôlés ; les fichiers WX sont examinés par leur structure ZIP/PE puis authentifiés par la signature de manifeste. La lecture PE contrôle désormais la signature DOS et lit l'en-tête à son offset déclaré, sans limiter arbitrairement cet offset aux 256 premiers octets. Les signatures et hashes ne sont pas une analyse antivirus.

Les hashes SHA-256 de l'archive et de l'installateur sont recalculés sur les copies de staging avant renommage. Un changement pendant la copie rejette la publication et conserve l'ancien manifeste. Tests de falsification du hash principal, du hash installateur, de la séquence et de la version minimale signée. Les sons publient les octets dont leur SHA-256 est calculé. Les fichiers et manifestes passent par staging/renommage atomique ; un échec de copie ou de renommage préserve la destination précédente.

Audit complet des fichiers de production de app/boundaries : assemblage Nest, alias de ports, délégation aux cas d'usage et projection des contrats uniquement. Aucun calcul de décision métier. Deux fabriques identité remplacées par useExisting ; projection synchrone et import RoomPayload par l'API publique. Les adaptateurs qui assemblent plusieurs capacités ou transforment des contrats restent justifiés ; les audits globaux 56 et 108 restent ouverts.

Preuves : logs/json134-upload-final.json (13 suites, 52 tests), logs/json134-release-boundaries.json (7 suites, 24 tests après contrôles de falsification), logs/json134-atomic-publication.json ; lint, typage, quality:check réussis. Compilation de 1 704 fichiers et chargement AppModule réussis : logs/json134-upload-boundaries-build.log. Les chunks rejetés pour métadonnées invalides sont aussi supprimés, trois cas réels vérifiés avec fichiers temporaires.

## Sérialisabilité avant clonage — point 35

La validation complète du snapshot précède désormais les clonages du service moteur et des stores, les restaurations/CAS SQL et mémoire et les snapshots du journal. Le test SQL prouve le rejet avant ouverture de transaction. La taille maximale désactivée ne désactive pas le contrôle de sérialisabilité. Les getters ne sont pas exécutés, les instances ne peuvent plus être transformées silencieusement en objets simples par structuredClone. Compatibilité Date native de roomStartedAt préservée, y compris entre contextes d'exécution ; faux Date et sous-classes rejetés.

Validation : logs/json134-snapshot-final.json (100 suites, 953 tests), lint, quality:check, compilation de 1 705 fichiers et chargement AppModule réussis. Point 35 retiré ; validation sémantique exhaustive de restauration (32) et passe finale après migration (128) restent ouvertes.

## Échanges standards — point 12

Cartes : transfer, exchange, swap et échanges aléatoires centralisés dans Cards ; inventaires : transfer, exchange, swap et variantes aléatoires centralisés dans Inventory. Ressources : ajout de resources.exchange et de l'instruction JSON exchange-resources. Les deux offres et tous les soldes sont vérifiés avant mutation et avant émission d'événement ; compensation préalable pour une même ressource, sans perte de précision aux bornes entières. Les sources insuffisantes, identifiants invalides et quantités non entières sont refusés atomiquement.

Voyage en terre de brumes délègue ses échanges à Resources, en conservant la sélection aléatoire des types de cartes propre au jeu et le transfert simple quand un côté est vide. Tests réels de cette règle avec les deux côtés pleins ou un côté vide, et replay identique. JSON : références des deux offres, exécution, rollback et replay vérifiés.

Contrat SDK 6.11.0 revu : seuls effect-ir.ts et player-values-kit.ts changent, plus le numéro de version ; 111 déclarations, aucun champ de snapshot nouveau. Preuves : logs/json134-resource-sdk-diff.log et logs/json134-resource-sdk-declarations.txt. Régressions : 137 suites et 1 045 tests (logs/json134-resource-broad.json), plus les deux scénarios Voyage dédiés. Lint, typage, quality:check, compilation de 1 709 fichiers et chargement AppModule réussis. Point 12 retiré.

Nettoyage temporaire : l'instance MySQL de validation est arrêtée ; le contrôle automatique a refusé la suppression de logs/mysql-json134-locks-20260911 (blocked by policy). Ce dossier est conservé.

Disponibilité des preuves : vers 19 h 50, le dossier backend/logs a été constaté absent, y compris le répertoire MySQL temporaire précédemment conservé. Aucune suppression de ce dossier n'a été exécutée par cette reprise après le refus automatique. Les résultats déjà lus ci-dessus restent le compte rendu des validations réalisées ; leurs anciens fichiers ne sont plus disponibles. Le dossier a été recréé pour les validations suivantes.

### Points 60 et 77 — événements publics et durées centralisées

60 : les notifications et Redis Pub/Sub vérifient les données avant sérialisation.
Les instances ORM/classes, accesseurs, propriétés cachées, cycles et collections
non JSON sont refusés sans appeler toJSON/getters. Les objets simples et les
références partagées non cycliques restent acceptés. Les événements de salles
exposent des identifiants, les présences des projections et les événements moteur
passent par le contrôle des états sérialisables. Les points 57–59 et 79 concernant
la fiabilité restent ouverts.

77 : durées de déduplication, session, conservation des uploads, leases de
publication/finalisation/maintenance et verrou local obsolète centralisées dans
operationalSettings, variables documentées et validation au démarrage. Les leases
refusent les durées hors bornes ; les schémas opérationnels sont regroupés sans
augmenter les seuils de taille des fichiers. Les autres TTL des salles, caches,
bots, présence et replay utilisent leurs paramètres nommés.

Preuves disponibles dans logs : json134-public-events.json (12 suites, 32 tests),
json134-retention.json (17 suites, 91 tests), json134-retention-config-final.log,
contrôles lint, json134-events-retention-quality.log et build réussis. La passe
json134-boundary-regressions.json a réussi 618 tests sur 619 ; son seul échec,
l'historique des migrations, a été corrigé sans changer les empreintes puis
revérifié dans json134-immutable-history.log. MySQL réel : 40 migrations dans
json134-immutable-mysql.log. json134-immutable-quality.log et build réussis
(1 713 fichiers et chargement AppModule).

Les adaptations temporaires des anciennes migrations ont été retirées. Leur
compatibilité est portée par MigrationDataSource, avec une limite explicite de
rollback pour DecoupleUserForeignKeys ; voir la revue persistence. L'instance
MySQL isolée est arrêtée ; ses fichiers sont dans logs/mysql-immutable-history-20260911.

### Point 86 — portée locale des verrous fichiers

Audit terminé des trois verrous fichiers : publication WX, finalisation WX et
maintenance. Les garanties distribuées viennent des leases Redis, obligatoires
pour ces opérations en production ; le fichier est une protection locale
supplémentaire. Preuve : logs/json134-local-distributed-locks.json (3 suites,
26 tests). Politique détaillée dans corrections-release-lifecycle-2026-09-10.md.

### Avancées sur 51 et 53, conservés ouverts

BotRoomReader remplace le repository complet pour les trois lectures de bots.
Les consommateurs admin utilisateurs/modération et coffre déclarent uniquement
leurs méthodes via Pick, en conservant les écritures nécessaires aux mutations.
Le coffre délègue au domaine Salle la vérification obligatoire du propriétaire
avant lecture du payload ou export de l'état privé ; il ne reconstruit plus cette
autorisation à partir d'une projection. Preuve : logs/json134-consumer-ports-final.json
(33 suites, 81 tests), incluant changement de propriétaire, save/restore/save et
composition Nest. Lint, json134-ports-quality.log et build réussis (1 714 fichiers).
Les audits complets des autres consommateurs/règles continuent : 51 et 53 restent ouverts.

### Point 10 — sélection générique des cartes

La recette JSON couvre paquet, main et défausse, filtres d'identifiants et
d'attributs scalaires, min/max, transfert vers une main ou la défausse,
propriétaires relatifs, choix délégué, timeout first/last/random et fallback
available jusque zéro candidat. Les propriétaires restent relatifs à l'initiateur
quand un autre joueur choisit. Les choix restent privés ; la continuation
persistée contrôle propriétaires et multiplicité avant mutation. Les anciennes
continuations sans chooser gardent leur forme.

Les attributs sont regroupés dans attributes ; le schéma des cartes reste fermé.
Les filtres inconnus/dangereux sont rejetés avant démarrage. Preuves :
logs/json134-card-selection-broad.json (31 suites, 495 tests), lint,
json134-card-selection-quality.log, build de 1 714 fichiers et AppModule chargé.
Le contrat SDK reste inchangé. Point 10 retiré ; son application aux jeux
historiques et leurs migrations restent suivies séparément.

### Point 38 — départages explicites

Audit des classements du moteur, des sélecteurs de gagnants des jeux et du classement SQL : les égalités utilisent soit tous les gagnants, soit un critère stable explicite (identifiant numérique, index du contenu ou ordre du tirage selon la règle). Deux choix dépendaient encore de l’insertion : les arrivées simultanées de Ça Dérape et le jury automatique de Gérard Président. Ils prennent désormais le plus petit identifiant numérique parmi les candidats admissibles ; leurs versions de règles passent respectivement à 3 et 2. Tests de départage avec bots et replay : 9 suites, 74 tests (logs/json134-ties.json). Les identifiants négatifs des bots sont acceptés par gameInput.playerId ; zéro et les entiers non sûrs restent rejetés (SDK 6.12, puis extension additive 6.13).

La vérification du catalogue a également identifié une incompatibilité des mains communes à plusieurs paquets dans Olympia. acceptedDecks rend les sources explicites et exige leur compatibilité avec le catalogue canonique ; les références inconnues et incompatibles échouent avant démarrage. Validation ciblée : 49 tests cartes/Olympia et 5 tests JSON. Validation générale : 77 suites, 844 tests, catalogue complet et runtime (logs/json134-mixed-broad.json) ; build et chargement AppModule réussis, lint et quality:check réussis (logs/json134-mixed-quality-final.log). Aucun seuil augmenté. Point 38 retiré après ces vérifications.

### Migration supplémentaire — Odyssée des Quatre Cieux

Le jeu utilise désormais manifest.json et game.json : quatre fichiers TypeScript spécifiques retirés. La recette pawn-race-roll compose les kits existants de dés, déplacement de pions, choix privé et fin de tour ; les références et les bornes sont validées avant démarrage. Trois parties complètes (graines 1, 7, 42 ; 1607, 1625 et 1633 événements) reproduisent exactement les empreintes des traces capturées avant migration (logs/json134-pawn-race-parity.json). Le catalogue compte désormais 6 jeux JSON sur 39. Les points de migration globale restent ouverts. La copie de travail JSON est conservée après le refus automatique du déplacement/nettoyage ; aucune suppression de cette copie n’a été retentée.

### Point 74 — accès aux diagnostics et snapshots

Audit des contrôleurs HTTP, handlers WS et enregistrements de routes : aucun export de snapshot brut ni commande debug du moteur n’est enregistré sur une API joueur. game.state passe par le contrôle de lecture de la salle et la projection du joueur. Vault conserve l’état brut côté serveur et ne renvoie que les métadonnées de sauvegarde, filtrées par propriétaire. Le diagnostic admin.perf.snapshot exige requireAdmin avant validation et lecture. Tests ajoutés : refus anonyme/joueur même avec rôle forgé dans le payload, accès administrateur, liste Vault sans snapshotJson ni état privé et liste vide pour un autre propriétaire. 5 tests passent (logs/json134-private-snapshots.json), 18 tests du lot de frontières passent, lint et security-boundary-audit réussis. Point 74 retiré.

### Renforcement partiel du point 17 — positions des pions

La fabrique pawns.set et la validation des composants refusent les tailles de piste invalides, positions initiales/d’entrée/zones finales hors limites et jets d’entrée non entiers ou non positifs. Trois mutations JSON prouvent le rejet avant démarrage ; 30 suites et 443 tests passent, y compris Foulées Fantastiques et les sélections de pions (logs/json134-pawn-bounds.json). Le contrat SDK reste inchangé. Le point 17 reste ouvert pour l’audit complet des autres références.

### Réduction supplémentaire des points 51 et 53 — capacité Room pour les bots

Le consumer Bot demande désormais assessBotMutation sous runRoomMutation ; le propriétaire Room évalue identité du propriétaire, lifecycle, capacité et minimum de participants dans la transaction protégée par le verrou de ligne. Bot ne reçoit plus le read model de salle ni le compteur d’humains pour reconstruire ces règles. Sa politique traduit uniquement la décision en codes d’erreur Bot existants. La liste divergente de statuts Bot a été supprimée : waiting/open/setup suivent resolveRoomLifecycleState de Room ; startedAt reste prioritaire. La restauration interne est une variante explicite qui conserve la contrainte de capacité.

19 tests passent (logs/json134-bot-capability.json), avec vérification complémentaire du refus avant sélection de nom/création (logs/json134-bot-capability-denial.json). Build 1724 fichiers et chargement AppModule, lint et quality:check réussis. Les points globaux 51 et 53 restent ouverts pour les autres consommateurs.

### Point 71 — identité serveur prioritaire

Audit des handlers WS et des connexions dédiées : l’acteur provient de requireUser(session), du JWT vérifié ou des métadonnées de socket établies à la connexion. Les userId fournis pour les relations sociales, conversations et profils sont des cibles distinctes ; ils ne remplacent pas l’acteur. GameWsCommandMapper réécrit actorId depuis la session et supprime les métadonnées de scheduling fournies par le client. Les tests couvrent les acteurs forgés, le propriétaire de profil injecté, l’anonymat et les rôles administrateur forgés. 37 suites, 178 tests passent (logs/json134-server-identity.json). Le point 71 est retiré ; l’autorisation métier du point 70 reste distincte et ouverte.

### Renforcement partiel des points 53, 70 et 80 — autorisation de jeu

GameWsRoomContextService délègue désormais authorizeGameAccess au domaine Room. RoomGameAccessService relit la salle et ses participants en base, sans cache ni publication de payload, et applique le roster actif commun de Room. Un propriétaire/participant actuel peut écrire ; un visiteur ne peut que lire une salle publique. Un départ, un passage spectateur, une salle disparue ou une panne de base ne conservent pas l’autorisation. Le contrôle d’écriture s’effectue après l’entrée dans la file de commandes de salle. Les tests vérifient les changements entre deux requêtes, les refus et le câblage des ports Nest. 15 suites, 82 tests passent, plus le test de composition ; build 1726 fichiers/AppModule, lint et quality:check réussis (logs/json134-game-access-*). Les points globaux restent ouverts.

### Renforcement partiel du point 36 — ordre des objets après persistance

Un test transversal compare désormais 60 commandes pour chacun des 39 jeux, avec et sans réorganisation des clés JSON entre chaque commande. Il a révélé des divergences dans Gérard Président (ordre de défausse) et Nawak (candidats aux votes). SubmissionSession.valueOrder enregistre maintenant explicitement l’ordre des soumissions ; les lectures, révélations et projections le reconstruisent, indépendamment de la représentation des objets stockés par MySQL. Le champ optionnel conserve la lecture des anciennes sauvegardes dans leur ordre observable, puis matérialise cet ordre à la prochaine écriture. Il ne peut pas retrouver un ordre ancien déjà perdu. Les incohérences de cet ordre sont rejetées avant utilisation. SDK 6.14, contrat additif revu ; algorithme moteur inchangé car les parties valides en mémoire conservent leurs décisions.

Le test a également permis de corriger le bot de Cercles Sacrés qui proposait une formation quand la main dépassait la limite, l’identifiant positif imposé à tort aux bots dans un effet de Contes, et l’usage de l’horloge réelle dans les validations/lectures du simulateur. Validation : 79 suites, 856 tests, dont les 39 comparaisons de persistance (logs/json134-order-broad.json) ; 23 comparaisons de traces antérieures de Gérard/Absurdissimes passent (logs/json134-order-parity.json). Build 1729 fichiers et AppModule, lint, SDK et quality:check réussis. Le point 36 reste ouvert : l’audit a aussi identifié des parcours de maps de quiz/choix spécifiques qui demandent des scénarios ciblés plus longs.

### Renforcement partiel du point 90 — enregistrement des tâches à arrêter

La détection des doublons utilise le nom normalisé de la source. Un nom entouré d’espaces ne peut plus remplacer silencieusement son callback de nettoyage. Les 8 tests de lifecycle passent, y compris HTTP/WS et drainage des opérations en cours (logs/json134-shutdown-sources.json). Le point global reste ouvert.

### Réduction partielle des points 56 et 108 — diagnostics administrateur

AdminPerfService et son test de retransmission ont été supprimés ; le handler injecte directement le port de lecture AdminPerfPort et conserve requireAdmin et la validation du payload. Les trois tests d’accès passent, ainsi que le build/AppModule et le lint (logs/json134-perf-direct-*). Le dossier devenu vide est conservé : le contrôle automatique a refusé sa suppression avec « blocked by policy ». Aucune nouvelle tentative de suppression n’a été faite. Les points globaux restent ouverts pour l’audit des autres intermédiaires.

### Point 36 — ordre explicite des résolutions collectives (complément)

Contes traite les égalités au défi du rire suivant `pending.order`, plutôt que les clés des réponses. Le test `laughter-order.spec.ts` fait répondre deux bots dans l’ordre inverse à proximité de l’arrivée et vérifie le gagnant ainsi que le replay. Mnémosyne résout les réponses suivant `participantPlayerIds`; `answer-order.spec.ts` vérifie les événements et le replay après trois réponses en ordre inverse. Versions des règles : Contes 3, Mnémosyne 2. Tests ciblés réussis (`logs/json134-explicit-round-order.json`, `logs/json134-quiz-answer-order.json`). Le point 36 reste ouvert pendant l’audit des autres collections du moteur.

### Point 32 — validation des grilles restaurées (partiel)

Les coordonnées persistées doivent désormais correspondre exactement à la forme canonique `x,y` : les alias (`00,0`, `-0,0`, coordonnées supplémentaires ou incomplètes) sont rejetés. Les tables de cellules et couches doivent être des objets, les couches des tableaux et leurs grilles doivent exister. Les 29 tests de restauration/grille JSON passent (`logs/json134-grid-restore.json`). Build/AppModule, lint et contrôle structurel passent (`logs/json134-grid-clock-*`). Le point 32 reste ouvert pour les autres composants.

### Point 75 — horloge métier obligatoire

Le planificateur BullMQ utilise désormais BusinessClock pour les délais et le contrôle d’échéance, injecté explicitement par le module WS. Les six tests couvrent notamment le report avant échéance, l’exécution à échéance exacte et la mesure du retard, sans dépendance à Date.now. La règle ESLint interdit Date.now(), new Date() et Date() dans les applications/domaines métier et le runtime ; les conversions de dates explicites restent autorisées. Les jeux conservent leur garde ctx.clock plus stricte. Le test du garde-fou est intégré à architecture:test. Audit de 703 fichiers : zéro violation (`logs/json134-business-clock-scan.log`), deux tests des garde-fous réussis, build/AppModule et contrôle architectural réussis. Les autres lectures d’horloge système auditées concernent la journalisation, les métadonnées de fichiers et les délais infrastructure ; les bans, cycles de room et expirations métier passent par les horloges injectées. Point retiré après vérification.

Complément point 36 : le contrôle des 39 jeux et les scénarios Contes/Mnémosyne passent ensemble (5 suites, 43 tests, `logs/json134-round-order-final.json`).

### Point 121 — audit structurel des séquences

Audit AST des 33 jeux TypeScript restants, complémentaire des clones normalisés : 197 fichiers et 1 364 fonctions examinés, dix séquences candidates regroupées en cinq familles et toutes relues. Le rapport game-structural-sequences-2026-09-11.md donne décisions, limites et inventaire. Cinq tests de régression de l’outil passent et sont intégrés au contrôle qualité. L’extraction de la distribution filtrée supprime six séquences ; les quatre candidates restantes ont une décision documentée et restent couvertes par les points de migration ouverts. Le point d’audit est terminé et retiré.

### Points 3, 5 et 11 — distribution initiale déclarative (partiel)

Entre Rites et Lumières et Les Mains de la Terre déclarent maintenant la taille de main et les cartes initialement écartées dans cards.hands ; les deux boucles et les deux setup-rules.ts ont été supprimés. L’option est disponible en JSON, avec validation des identifiants avant démarrage et restauration déterministe des cartes écartées. SDK 6.15 : seules HandsDefinition et les signatures deal des deux contrôleurs changent de façon additive ; 111 fichiers de déclaration revus. Six traces initiales capturées avant refactor restent identiques, replay compris hors tampon de transport. Tests cartes/JSON/parité : 5 suites, 60 tests. Vérification étendue runtime/catalogue : 83 suites, 892 tests réussis (logs/json134-deal-runtime-catalog.json), build/AppModule, lint et structure sans régression. Les points globaux restent ouverts.

### Point 69 — conservation des reçus pendant la fenêtre de répétition (partiel)

Le cache local supprimait les commandes terminées lorsqu’il atteignait sa capacité, avant expiration de leur TTL : une même mutation pouvait alors repartir ou un payload différent ne plus être reconnu. Les reçus restent désormais présents jusqu’à leur échéance ; la saturation refuse les nouvelles clés mais accepte le rejeu des clés connues et détecte leurs collisions. Un callback fail tardif ne peut plus retirer un reçu terminé. 2 suites, 16 tests réussis (logs/json134-replay-retention.json). La protection transversale reste locale à l’instance ; le point 69 reste ouvert pour sa durabilité multi-instance. Les commandes de jeu disposent en plus de leur journal persistant.

### Point 91 — quotas des surfaces abusables

Audit de toutes les entrées WS (API/jeu, room, présence/chat, notifications) et des contrôleurs HTTP : quota Redis partagé avant les handlers, aucun SkipThrottle. Ajout d’un budget d’authentification par adresse réseau, partagé entre comptes et instances pour auth.login, auth.register et auth.refresh (20/minute par défaut, configuration validée et documentée). Le quota général continue de protéger chat, invitations et commandes coûteuses ; une panne Redis refuse les commandes. La factory HTTP dépend maintenant du contrat minimal ThrottlerStorage. Le test HTTP utilise les gardes globaux réels d’AppPlatformModule dans deux applications et vérifie qu’un upload dépassant le quota retourne 429 avant l’intercepteur. Preuves : 30 tests des surfaces/stockage Redis, 42 tests de configuration, 4 tests présence/notifications et le test HTTP ; build/AppModule, lint, architecture, structure et audit de sécurité réussis (logs/json134-rate-limit-_, json134-auth-quota-_, json134-http-quota.*, json134-presence-notify-quotas.json). Point retiré après vérification.

### Point 78 — convergence de la présence multi-instance

Les snapshots complets sont ordonnés par origine et séquence, expirent après le TTL configuré (120 secondes par défaut) et sont renouvelés par heartbeat (30 secondes, délai pong 10 secondes). La capacité locale est alignée sur les 1 000 joueurs acceptés par le transport ; une admission refusée ferme la connexion avant ses handlers. La reconnexion Redis rétablit aussi un abonnement initialement refusé et attend une ancienne commande encore en échec, sans multiplier les listeners. Chaque consommateur reçoit une copie indépendante. À l’arrêt, les sockets et leurs délais/listeners sont nettoyés et un snapshot vide séquencé retire immédiatement l’origine lorsque le transport est disponible ; le TTL couvre la perte de ce dernier message. Le test de convergence simule perte, retard, expiration et nouvelle origine après redémarrage. Validation finale : 12 suites, 75 tests (logs/json134-presence-recovery-final.json), build 1 736 fichiers/AppModule, lint, architecture, structure et audit des timers réussis. Point retiré après vérification.

Compléments partiels : le nettoyage présence/PubSub renforce le point 90, qui reste ouvert pour les autres ressources. La dépendance de messagerie de PresenceService est réduite aux quatre méthodes consommées (point 51 encore ouvert). Pub/Sub reste un transport best effort : les points 57 et 79 ne sont pas clôturés.

### Point 90 — callbacks tardifs et erreurs de nettoyage (partiel)

RoomLobbyRefreshService annule son timer et refuse toute réinscription ou notification après destruction ; son port hub est limité à send. RoomEventsBusService libère ses trois ensembles de listeners et refuse les abonnements tardifs. Le service central attend maintenant tous les callbacks de fermeture même si un premier échoue, puis restitue chaque erreur (AggregateError en cas de pluralité). Les ressources ne sont pas fermées prématurément sur cet échec. Validation : 11 tests lifecycle/lobby et un test du bus réussis, build/AppModule, lint, architecture, structure et timers réussis (logs/json134-shutdown-*, json134-room-listener-shutdown.json). Point conservé pour l’audit global restant.

### Points 73 et 127 — isolation des projections privées (partiel)

projectVisibility copiait les valeurs publiques mais gardait une référence directe à la main privée du joueur. Les valeurs privées sont désormais clonées en profondeur. Le test modifie un objet imbriqué de la projection sans altérer le state et vérifie qu’un spectateur ne reçoit aucune main. 11 tests de visibilité/projection réussis (logs/json134-private-projection.json). Les points globaux restent ouverts.

### Points 3 et 11 — remplissage de main commun (partiel)

Suppression des boucles fillHand/refillHand dans Cercles Sacrés et Gérard Président. Les quatre sites appellent cards.drawManyToHand avec le déficit de main et le recyclage explicite. Aucun nouveau wrapper ni contrat SDK. Six traces capturées avant modification, jusqu’à 300 commandes chacune, restent identiques ; les tests des deux jeux et des cartes spéciales passent aussi (4 suites, 32 tests, logs/json134-refill-parity.json). Build 1 739 fichiers/AppModule, lint, audit moteur et structure réussis. Les points globaux restent ouverts.

### Points 57, 58, 79 et 105 — réconciliation des sessions après suppression/réinitialisation (partiel)

Les callbacks de salle ne suppriment plus aveuglément toutes les sessions. Ils déclenchent le balayage persistant existant ; celui-ci compare chaque session à la décision du domaine Room (lecture SQL des seuls gameType/status/runId, sans cache ni relations eager). Une session obsolète est supprimée conditionnellement à sa version et son identité de restauration. Le balayage au démarrage et toutes les cinq secondes, par pages de 100, couvre les signaux perdus et les suppressions en lot ; une panne SQL conserve la session pour un nouvel essai. Un signal tardif ne supprime pas la partie courante. Les tâches automatiques contrôlent aussi cette décision avant exécution. Les suppressions de salle individuelles publient après la réussite SQL, ce qui évite déconnexions et nettoyages sur échec de suppression.

Preuves : 12 suites, 59 tests incluant remplacement concurrent à version identique, répétition sans double suppression, panne de lecture, planification et composition Nest (logs/json134-reconciliation-broad-final.json) ; deux tests d’ordre suppression/publication (logs/json134-room-delete-order.json). Build 1 747 fichiers/AppModule, lint, architecture et structure réussis (logs/json134-reconciliation-delete-*). La pagination existante et ses timers restent bornés. Les contrats GameRoomRunReader/RoomGameRunReader exposent une seule décision, et les services concernés reçoivent des facettes minimales (points 51/53/98 partiellement renforcés). Les points globaux restent ouverts pour les autres flux ; aucune garantie de livraison durable n’est attribuée à Pub/Sub.

### Points 57, 58, 59 et 79 — flux critiques et contrats durables terminés

L'audit complet des abonnements confirme que Redis Pub/Sub sert uniquement la présence et les notifications temps réel, qui sont des vues reconstructibles. Le seul consumer inter-domaines qui supprimait une donnée métier, Room vers Game, est maintenant une réconciliation MySQL périodique et au démarrage. Elle est répétable et protégée par `runId`, version et identité de restauration ; les tests couvrent perte, doublon, retard, panne SQL et remplacement concurrent. Les autres listeners Room ne font que reconstruire ou pousser une vue. Les invitations et droits temporaires de spectateur sont maintenant persistés dans `room_invites`, partagés entre instances, consommés sous verrou pessimiste, expirables et supprimés en cascade. La recherche de 1 000 destinataires utilise une requête groupée, et les lignes expirées sont nettoyées par lots bornés.

Les événements durables Game ont l'identité composite `(roomId, gameType, seq)`, une séquence validée sans trous ni doublons, la version du state et `schemaVersion=1`. Les anciens événements sans champ sont explicitement v1 ; les versions inconnues sont refusées. Validation : 45 tests des événements, consumers, présence et Pub/Sub (`logs/json134-critical-events-final.json`) ; 43 tests de persistance/réconciliation (`logs/json134-durable-room-final.json`) ; migration réelle MySQL complète, rollback de la nouvelle table et réapplication de 41 migrations (`logs/json134-invite-mysql-final.log`) ; build 1 754 fichiers/AppModule, typecheck, lint TypeScript, architecture, structure et timers réussis. Points 57, 58, 59 et 79 retirés après vérification. Le point 105 reste ouvert pour les autres opérations infrastructure.

### Point 101 — surveillance et suppression des N+1

L'audit AST couvre les domaines user, messaging, notification, social, stats et room. Il refuse les `await` dans les boucles sensibles, les appels de repository cachés dans un `map(async ...)`, les collections TypeORM sans `take/limit` et les query builders non bornés. Ses cinq tests prouvent les formes positives et négatives. L'audit complet passe sans violation (`logs/json134-nplus1-guard-final*.log`).

Deux défauts réels ont été corrigés pendant cette passe. La présence d'invitations pour jusqu'à 1 000 joueurs est lue par un seul `IN` borné. Les changements d'état d'un fil de contact utilisent une seule mise à jour SQL conditionnelle au lieu d'une lecture/écriture par ligne ; la création multi-destinataires est transactionnelle et découpée par lots de 500, et la suppression accepte les 500 lignes maximales lues. Les tests ciblés passent (`logs/json134-nplus1-final.json`), ainsi que typecheck, lint et build/AppModule (`logs/json134-nplus1-*-typecheck.log`, `json134-nplus1-final-lint.log`, `json134-nplus1-build.log`). Point retiré après vérification.

### Point 90 — arrêt gracieux complet

L'entrée de shutdown refuse d'abord les nouvelles commandes et connexions, arrête
les producteurs et workers enregistrés, draine les opérations acceptées, ferme les
sockets, draine les écritures de déconnexion, attend la fermeture HTTP puis laisse
Nest fermer les ressources DB et Redis. Chaque phase continue même si une autre
échoue ; une erreur unique est conservée et plusieurs erreurs sont regroupées dans
un `AggregateError`. Les gestionnaires de signaux sont toujours retirés. Les
sources sont arrêtées une seule fois, toutes sont attendues, et les inscriptions
tardives ou dupliquées sont refusées.

L'audit couvre aussi les callbacks tardifs du lobby, les listeners du bus Room,
les heartbeats et sockets de présence, le worker BullMQ, la récupération des
tâches, les sessions et stockages Redis, les notifications, métriques, caches et
timers périodiques. Les tests réels HTTP/WS vérifient qu'une commande acceptée et
son écriture de déconnexion finissent avant la fermeture des ressources. Les
échecs simultanés d'une source et des sockets prouvent que `app.close()` est tout
de même appelé. Validation finale : 21 suites et 70 tests
(`logs/json134-shutdown-owners-final.json`), build/AppModule, lint ciblé,
architecture, structure et audit des 19 timers réussis
(`logs/json134-shutdown-*.log`). Point retiré après vérification.

### Points 67 et 68 — ordre et resynchronisation temps réel

Les snapshots Game contiennent déjà `roomId`, `runId` et la version CAS. Le
serveur ne diffuse pas un état plus ancien pour une connexion et `game.state`
reconstruit une projection complète après autorisation Room. Les snapshots Room
portent maintenant un `streamId` propre au processus, une `sequence` monotone
par salle et `snapshot: true`. Les lectures et publications Room sont
sérialisées afin qu'une lecture lente ne dépasse pas la suivante. `room.state`
permet une relecture complète et utilise exclusivement la salle authentifiée de
la socket, même si le payload contient un autre identifiant.

Chaque socket de présence reçoit aussi un flux identifié et séquencé de
snapshots complets. `presence-sync` renvoie immédiatement la vue fusionnée
courante et `chat-sync` recharge l'historique. Room expose déjà
`room.chat.history`, le lobby sa liste complète, et Notification
`notify.inbox.list` avec corrélation par `requestId`. Les notifications
temps réel restent des signaux vers cette inbox durable.

Validation : 40 suites et 215 tests Room, Game, Presence et Notification
(`logs/json134-realtime-resync-final.json`), scénario dédié de récupération
Game (`logs/json134-game-realtime-resync.json`), build/AppModule, lint ciblé,
architecture et structure réussis (`logs/json134-realtime-resync-*.log`).
Les tests couvrent les versions retardées d'un ancien run, les sauts de version,
la sérialisation de deux lectures Room concurrentes, le changement de
`streamId` après redémarrage et les commandes explicites de snapshot. Points
67 et 68 retirés après vérification.

### Point 36 — déterminisme des collections terminé

La passe transversale réorganise récursivement les clés JSON entre chaque
commande pour les 39 jeux et compare décisions, événements et état final. Les
ordres qui influencent le gameplay sont maintenant portés par les tableaux du
contenu, les listes de participants, `valueOrder` pour les soumissions,
`pending.order` pour les résolutions collectives, ou un tri numérique stable.

La dernière revue a supprimé quatre ambiguïtés génériques. `assetsOf` et
`releaseAll` suivent l'ordre des biens déclaré par le registre d'ownership ;
`grid.entries` parcourt les cases par ligne puis colonne ; un ancien état Dice
sans `lastRollId` utilise l'ordre des définitions puis un ordre textuel stable ;
le stade des soumissions applique une priorité explicite entre vote, collecte,
révélation et fin. La perte aléatoire d'un bâtiment Sac à Malices parcourt
directement l'ordre des cases du plateau, et Nawak trie les gagnants simultanés
par identifiant. Les égalités de classement, Contes et Mnémosyne avaient déjà
leurs ordres explicites.

L'audit des autres `Object.keys/values/entries` du runtime les classe comme
validation, projection, agrégation commutative ou parcours d'une définition
statique. Validation finale : 126 suites et 1 006 tests
(`logs/json134-determinism-broad-green.json`), lint ciblé, audit moteur,
build de 1 758 fichiers et chargement AppModule réussis
(`logs/json134-determinism-*.log`). Point retiré après vérification.

### Point 73 — visibilité générique des données cachées

La projection du moteur applique la confidentialité à partir de la définition
des composants : les mains privées ne montrent qu'un compteur aux autres
joueurs, les zones cachées ne révèlent pas leurs cartes, et les inventaires ou
biens privés ne sont détaillés que pour leur propriétaire. Les projections
génériques des réponses de quiz, soumissions secrètes, choix en attente et
événements privés suivent la même règle. L'état interne `engine`, les métadonnées
et le journal ne font jamais partie de la vue exposée.

Un contrat transversal démarre désormais les 39 définitions de jeu, construit
la vue spectateur et celle de chaque joueur, puis contrôle toutes les mains,
zones, collections et propriétés privées réellement présentes. Il vérifie aussi
qu'une mutation de la projection ne modifie pas l'état interne. Ce contrat et
les suites spécialisées totalisent 6 suites et 60 tests réussis
(`logs/json134-hidden-projection.json`). Le lint ciblé, Prettier, le build avec
chargement AppModule, les audits d'architecture, de structure et du moteur sont
également réussis (`logs/json134-hidden-projection-*.log`). Point retiré après
vérification.

### Migration JSON — À fond les ballons

À fond les ballons est maintenant défini par `game.json`. Le programme moteur
fermé porte la piste, les pions, le paquet Loufoque, la pioche manuelle, les
cases spéciales et les huit effets propres au jeu. L'attente de pioche des
nouvelles parties appartient au kit de statuts sérialisable ; la lecture du
champ historique reste assurée pour continuer les snapshots déjà persistés.
La migration relie `a-fond-les-ballons@content:c5adb978` à la version JSON.

La comparaison ancien/nouveau passe sur les graines 1, 7 et 42, commande par
commande. Le scénario officiel couvre aussi explicitement la reprise d'un
snapshot historique en attente de pioche. Après suppression des six modules
TypeScript du jeu, les 27 tests du lot final, le typecheck de production, le
formatage et l'audit moteur sans violation passent. Le catalogue compte 33 jeux
JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Le Corridor

Le Corridor est maintenant défini par `game.json`. Son programme moteur fermé
porte la grille 9 × 9, la sélection séquentielle des pions, la configuration du
nombre de murs, les déplacements avec saut et diagonale, le contrôle des murs et
la victoire sur le bord opposé. La migration de snapshot relie la version de
contenu historique `corridor@content:1adb0e9e` à la version JSON.

La comparaison ancien/nouveau couvre trois graines et deux parcours complets par
graine : huit murs avec contrôle de chemin, puis déplacement, saut et victoire.
Le journal, l'état métier et l'état moteur hors métadonnées de version sont
identiques après chaque commande. Les 6 tests de parité, les 13 tests ciblés
après suppression, les 53 tests du lot global, le typecheck de production et
l'audit moteur sans violation passent. Le catalogue compte 31 jeux JSON sur 39 ;
le point 1 reste ouvert.

### Migration JSON — LAMA

LAMA est maintenant défini par `game.json`. Le programme fermé du moteur porte
le paquet de 140 cartes, les mains privées, la configuration propriétaire, les
manches, la pioche, le jeu, la sortie, le rendu de jetons et l'élimination au
seuil de score. La migration de snapshot relie la version historique
`lama@content:bc467eda` à la version JSON.

La comparaison ancien/nouveau exécute jusqu'à 300 commandes pour chacune des
graines 1, 7 et 42 et compare chaque état intermédiaire. Les trois tests de
parité, les 17 tests ciblés finaux, le typecheck de production, le formatage et
l'audit moteur sans violation passent après suppression du code hérité. Le
catalogue compte 32 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — LAMA

LAMA est maintenant défini par `game.json`. Le programme moteur fermé conserve
le paquet configurable, les mains privées, la règle de pose cyclique, la pioche,
la sortie de manche, le décompte unique des valeurs, le rendu de jetons, les
pauses temporisées et l'élimination au seuil configuré. La migration de snapshot
relie `lama@content:bc467eda` à la version JSON.

La comparaison ancien/nouveau exécute 900 commandes aux graines 1, 7 et 42 et
compare chaque état. Les 3 tests de parité, les 17 tests ciblés finaux, le
typecheck de production et l'audit moteur passent. Le catalogue compte 32 jeux
JSON sur 39 ; le point 1 reste ouvert.

### Point 110 — options discriminées et assertions non-nulles

Les chemins conditionnels complexes utilisent des unions discriminées (`kind`)
et sont exhaustivement réduits avant accès. Les deux dernières assertions
d'assignation locales, dans le reçu de rejeu temps réel, ont été remplacées par
un objet deferred dont le resolver est vérifié. Les assertions restantes sont
les champs initialisés par Nest, TypeORM ou `class-validator`, et ne représentent
pas des options conditionnelles. Un test d'architecture balaie désormais tout le
code de production et interdit le retour de `let/const/var value!: Type`.

Validation : test architectural et suite de rejeu réussis
(`logs/json134-discriminated-options.json`), plus typecheck de production, lint
et formatage ciblés (`logs/json134-discriminated-options-*.log`). Point retiré
après vérification.

### Point 111 — vocabulaire des types

La convention donne maintenant une portée stable à `Entity`, `Model`, `Record`,
`DTO`, `Command`, `Query`, `Port` et `Adapter`. Elle décrit aussi précisément
les modèles applicatifs déjà présents, au lieu d'affirmer à tort que leur dossier
était interdit. Le nouvel audit de nommage vérifie les emplacements de chaque
suffixe, le décorateur des entités ORM et les noms des classes DTO et Adapter.
Il est exécuté par `quality:check` et ses tests prouvent qu'il refuse chaque
catégorie placée à une frontière trompeuse.

Validation : `naming:audit` réussi sur les 207 fichiers catégorisés du dépôt et
2 tests de contrat réussis, plus typecheck de production, layout, architecture
et formatage ciblé. Point retiré après vérification.

### Point 112 — null et undefined aux frontières externes

La convention wire est désormais unique : une propriété facultative à
`undefined` est omise, `null` exprime une absence explicite, et un tableau ne
peut jamais contenir `undefined`. Les DTO n'acceptent `null` que lorsqu'une
commande déclare explicitement ce sens. `stringifyExternalJson` vérifie ces
règles, les limites JSON et les valeurs non sérialisables avant toute émission.
Les transports WS, Redis Pub/Sub et Notification utilisent tous ce sérialiseur ;
les projections nullables stables continuent d'utiliser `normalizeOptional`.

Validation : 4 suites et 6 tests de sérialisation et de transports réussis
(`logs/json134-null-undefined.json`), plus typecheck de production, lint,
formatage ciblé et audit d'architecture. Point retiré après vérification.

### Point 123 — allowlists temporaires

Les baselines d'architecture et de structure sont vides. Le contrôle final
refuse toute nouvelle exception dans ces deux registres et ses tests négatifs
le démontrent. Les cinq anciens dossiers racine déclarés comme migrés sont
absents. L'audit des jeux ne porte plus une allowlist de chemins : l'unique
entrée autorisée est reconnue comme l'API publique du SDK, quelle que soit la
profondeur relative. Les listes restantes sont des politiques permanentes de
sécurité, de composition ou de validation et ne masquent aucune dette migratoire.

Validation : contrôle de 1 347 fichiers applicatifs et 3 tests des registres de
dette réussis ; 1 suite et 33 tests de l'audit Game réussis
(`logs/json134-temporary-allowlists.json`), plus typecheck, lint et formatage
ciblé. Point retiré après vérification.

### Point 124 — anciennes APIs, loaders et adapters

L'inventaire de production ne contient aucun symbole déprécié ni aucun adapter,
API, service ou loader nommé Legacy/Compatibility. Le seul `game-state-loader`
est le chargeur canonique actuel qui applique le graphe versionné des snapshots ;
les adapters recensés implémentent tous des ports actifs. Le contrôle final a été
étendu aux loaders pour interdire le retour d'un ancien chemin applicatif. Les
migrations SQL historiques restent immuables et hors de cette règle.

Validation : 1 347 fichiers applicatifs contrôlés, 4 tests positifs/négatifs du
contrôle final réussis, audits code mort, séparation runtime et architecture du
moteur sans violation. Point retiré après vérification.

### Points 2, 133 et 134 — généralité et création JSON pure

Le catalogue contient maintenant six jeux sans aucun TypeScript auteur. Ils
couvrent course de pions, parcours à événements, grille, cartes jugées,
distribution, choix privés, quiz, ressources et victoire. `les-absurdissimes`
apporte à lui seul 4 097 lignes JSON et un cycle multijoueur de soumission,
révélation, jugement et score ; sa parité avec les traces antérieures est testée.
Ce corpus complexe complète Panier Express et Course des Étoiles et démontre que
les primitives restent partagées par plusieurs profils.

Le générateur officiel `create:game --json-only` crée un jeu jouable à partir de
`manifest.json` et `game.json`, avec contenus JSON fractionnables ; `rules.md`
reste une documentation sans mécanique exécutable. Le registre découvre le
paquet, compile le document et refuse les contenus invalides sans remplacer son
résultat précédent.

Validation : 5 suites et 96 tests de compilation, schéma, parties et parité du
jeu complexe réussis (`logs/json134-complex-json-games.json`) ; 11 tests du
générateur, du registre et des contenus JSON réussis ; build de 1 767 fichiers
et chargement AppModule réussis. Points retirés après vérification.

### Points 17 et 32 — références et restauration complètes

La compilation indexe les composants avant de valider toutes les références :
decks, mains, cartes, pistes, dés, pions, inventaires, ressources, propriétés,
phases, actions, timeouts, conditions, effets, choix, réactions et catalogues.
Elle inspecte aussi les contenus non installés et les collections Map/Set. Une
référence absente échoue donc avant la création du runtime.

La restauration clone puis migre le snapshot avant de contrôler versions,
empreinte de contenu, scheduler/tâches, joueurs, tours, manches, valeurs
numériques, composants, cartes et file/continuations d'effets. Une corruption
échoue aussi lors d'une projection et ne modifie jamais l'objet source.

Validation : 14 suites et 275 tests de références, compilation, sérialisation,
migrations et restauration réussis (`logs/json134-references-restoration.json`),
plus audit moteur et typecheck de production. Points retirés après vérification.

### Point 45 — échecs des effets d'infrastructure

La politique est maintenant explicite par nature : rollback SQL pour l'état et
le journal obligatoires ; cinq tentatives idempotentes, backoff, dead letter et
réconciliation SQL pour les réveils BullMQ ; abandon sûr d'un ancien réveil ;
best effort reconstructible pour WS, présence et lobby ; abandon journalisé pour
les statistiques secondaires. Le moteur synchrone interdit toute API externe aux
règles, ce qui empêche un nouvel effet de contourner cette classification.

Validation : 7 suites et 30 tests de commit, idempotence, scheduler, reprise et
réconciliation réussis (`logs/json134-infrastructure-effects.json`) ; 37 tests
d'audit moteur, audit des retries et formatage de la matrice réussis. Point
retiré après vérification.

### Points 51 et 53 — ports minimaux et domaine propriétaire

Les consommateurs en lecture reçoivent des contrats dédiés : participants
actifs, compteurs de messages, amis acceptés, bots, run courant, staff et payload
Room. Les ports à une seule opération de suppression ou lecture ne donnent pas
accès au repository propriétaire. Le repository Bot complet reste injecté
uniquement aux workflows Bot qui exécutent ses mutations atomiques ; ses queries
utilisent `BotRoomReader`.

Les règles inter-domaines passent par des capabilities appartenant au consumer
et liées à la composition racine. L'audit interdit l'import du stockage étranger,
y compris via aliases, barrels et modules de composition, ainsi que les imports
privés entre domaines. Les adapters testés délèguent les décisions Room, Vault,
Messaging, Social et Bot à leurs services propriétaires.

Validation : 35 tests d'architecture et 5 tests de persistance réussis, graphe
de 1 387 fichiers/70 composants sans violation, 2 tests d'intégration Nest des
ports (`logs/json134-domain-ports.json`) et typecheck de production réussis.
Points retirés après vérification.

### Points 8 et 11 — lifecycle et séquences génériques

Les jeux ne modifient directement aucun champ `turn`, `round`, numéro de tour ou
joueur courant. Ils passent tous par les contrôleurs du moteur. Quatorze appels
recalculaient encore inutilement l'attente d'un choix avant `turn.complete` ; ce
contrôleur protège déjà les choix, effets et parties terminées, ces duplications
ont donc été supprimées sans changement de comportement.

Les trois dernières séquences multi-jeux détectées ont été ramenées aux
primitives communes : `drawAndResolve` gère pioche/recyclage/destination,
`counter.drain` lit et remet atomiquement à zéro, et les compteurs décrémentés
utilisent leur API. L'analyse structurelle ne trouve désormais aucun candidat
répété sur 1 366 fonctions de 195 fichiers.

Validation : 7 suites et 46 tests de jeux et de kits réussis
(`logs/json134-generic-sequences-final.json`), audit des séquences sans candidat,
typecheck de production, lint et formatage ciblé réussis. Points retirés après
vérification.

### Points 3, 4 et 6 — audit du TypeScript spécifique

Les 195 fichiers auteur et leurs 1 366 fonctions ont été analysés par familles
de capacités et par séquences de contrôle. Il ne reste aucun groupe dupliqué
entre jeux. Les 11 fichiers `rule-bindings.ts` restants portent exclusivement
des choix validés, projections propres au jeu, hooks de manche ou automatismes
avec une règle métier ; aucun n'est un simple raccord événement/effet. Les dix
fichiers d'effets restants calculent des règles propres au contenu ou composent
les primitives partagées, sans réimplémentation standard commune.

Les dernières répétitions concrètes ont été retirées dans ce lot : pioche et
destination passent par `drawAndResolve`, et lecture/remise à zéro d'un compteur
par `counter.drain`. La migration JSON globale et deux setups encore standards
restent suivis séparément par les points 1 et 5.

Validation : audits de séquences et de duplication sans candidat, audit moteur
sans violation, 7 suites/46 tests de non-régression et typecheck de production
réussis. Points retirés après vérification.

### Points 13 et 24 — validation et ergonomie auteur

Les validations de forme des jeux emploient désormais les combinators fermés du
SDK. Aucun garde structurel `isCard` ou `isTile` ne subsiste ; `isCardBlocked`
est une décision de règle Olympia. Les 33 modules de contenu structurés passent
l'audit et 859 usages des schémas communs couvrent objets, unions, collections,
cartes, nombres et identifiants.

Le format auteur sépare le manifeste, la règle lisible et les catalogues JSON.
`$content` permet de fractionner un document sans changer son empreinte résolue,
avec JSON Pointer, ordre stable et diagnostics précis de référence. Le
générateur produit un paquet jouable minimal et les schémas fermés refusent au
plus tôt les champs inconnus. Le guide documente chaque primitive avec des
exemples et sa politique de versionnement.

Validation : 4 suites et 67 tests de schémas, références et effets réussis
(`logs/json134-authoring-validation.json`) ; 9 tests du générateur/contenus,
audits texte (0 violation), structure de 33 contenus et moteur réussis. Points
retirés après vérification.

### Point 30 — versions historiques de contenu

Les snapshots portent séparément versions de schéma, d'algorithme, de règles,
de contenu et empreinte du document résolu. Une version identique est chargée,
une version différente exige un chemin explicite dans le graphe de migrations ;
cycles, ambiguïtés, plus de 64 étapes, modification d'identité et sortie non
sérialisable sont refusés sans toucher au snapshot source. Sans migration sûre,
le runtime ancien doit être conservé jusqu'à la fin des parties concernées.

Les releases externes sont adressées par SHA-256, confinées au répertoire signé
et ne remplacent jamais silencieusement un contenu sauvegardé. Les identités des
jobs incluent aussi les versions pour empêcher une ancienne tâche d'agir sur une
nouvelle définition.

Validation : 6 suites et 46 tests de versions, empreintes, migrations, releases,
loader et tâches réussis (`logs/json134-content-compatibility.json`), plus audit
moteur et typecheck de production. Point retiré après vérification.

### Point 5 — setups standards déclaratifs

L'initialisation commune accepte désormais des distributions de cartes par
joueur, avec pioche de repli explicite, ainsi que des placements ordonnés sur
une grille et l'initialisation de ses couches vides. Le compilateur vérifie les
pioches, les mains et leurs catalogues acceptés, les grilles, les coordonnées,
les quantités et la capacité par rapport au nombre de joueurs avant mutation.

Olympia déclare sa divinité, ses deux créatures et sa carte action dans
`initialization.deals`. Corridor déclare les deux positions de départ et sa
couche de murs dans `initialization.gridPlacements`. Leurs deux fichiers
`setup-rules.ts` ont été supprimés ; l'ordre du tour, les ressources et la
sélection de pions standards étaient déjà déclaratifs. Validation : 5 suites et
37 tests réussis (`logs/declarative-setup-final.json`), typecheck de production
et formatage ciblé réussis. Point retiré après vérification.

### Migration JSON — Taxi Express

Taxi Express est maintenant composé uniquement de `manifest.json`, `game.json`,
`rules.md` et de ses contenus JSON. La recette moteur fermée `delivery-race-roll`
porte la prise d'un client, l'obstacle, le déplacement, la livraison, le score
et la victoire. Ses références et attributs sont validés avant démarrage ; un
test moteur atteint la victoire et le test du jeu vérifie la confidentialité de
la main, la défausse et le replay. Le catalogue compte 7 jeux JSON sur 39. Le
point 1 reste ouvert jusqu'à migration des 32 autres jeux TypeScript.

### Migration JSON — Jeu de l'Oie

Le Jeu de l'Oie est maintenant composé uniquement de `manifest.json`,
`game.json`, `rules.md` et `content/catalogue.json`. La recette fermée
`goose-race-roll` conserve la sélection séquentielle des pions, l'ordre de
départ aléatoire, le rebond, les cases Oie, pont, auberge, dé magique, puits,
labyrinthe, prison, mort et arrivée, ainsi que la visibilité publique du statut
du puits. Le validateur refuse les pistes, dés, phases, pions et destinations
incohérents. Validation : 4 suites et 88 tests réussis
(`logs/goose-json-final.json`), typecheck de production, métriques et audit
moteur réussis après extraction des validations de course dans un module dédié.
Le catalogue compte 8 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Mon Village, Mon Histoire

Le jeu est maintenant défini par `game.json` et un catalogue JSON modulaire.
La recette fermée `collection-race-roll` déplace le joueur, pioche et défausse
la carte de la zone, met à jour score et ressource, puis classe les joueurs à
l'arrivée avec les huit zones comme départages successifs. `collection.view`
est désormais accepté par le schéma JSON fermé afin de conserver la projection
agrégée du jeu. Le validateur refuse les plages inversées, zones dupliquées,
pioches ou ressources inconnues et cartes attachées à une autre zone.

Validation : 4 suites et 88 tests réussis (`logs/village-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 9 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Primalis

Primalis est maintenant défini par `game.json` et son plateau JSON. La recette
fermée `ecosystem-race-roll` conserve la relance bornée, les cinq faces, les
quatre ressources, les bonus de cases, l'amplification du danger, le déplacement
collectif et le classement final. Le schéma contrôle la correspondance entre
faces et dé, la piste, les ressources et le compteur. Les validations de
composants ont été extraites afin de maintenir chaque fichier runtime sous sa
limite structurelle.

Validation : 4 suites et 88 tests réussis (`logs/primalis-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 10 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Pirates en vadrouille

Pirates en vadrouille est maintenant défini par `game.json` et son catalogue
JSON. La recette fermée `pirate-race-roll` conserve les trois pioches cycliques,
la collection publique limitée à cinq cartes, les pièces d'or, les effets bonus
et obstacle, l'immunité consommable, le vol ciblé et la condition du coffre avec
recul en cas d'échec. Le validateur contrôle la piste, le dé, les paquets, les
inventaires, la ressource et la cohérence des seuils.

Validation : tests du jeu, du schéma et du contrat tout déclaratif réussis,
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 11 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — La Parade Sucrée

La Parade Sucrée est maintenant définie par `game.json` et un catalogue JSON.
La recette fermée conserve la distribution des treize cartes, la séquence
imposée, les passes, les enchaînements possibles par un même joueur, les gains
de bonbons spéciaux et le classement pondéré. Le validateur refuse les cartes
ou valeurs dupliquées, les séquences incomplètes et les ressources inconnues.

Validation : 3 suites et 42 tests réussis (`logs/parade-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 12 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Dame Nature

Dame Nature est maintenant défini par `game.json` et un catalogue JSON. La
recette fermée conserve les demandes de cartes, la pioche après échec, les sept
familles, les cartes Nature et Quiz, le plafond de pollution et les deux issues
de victoire. La distribution initiale diffère les cartes Nature et Quiz afin
que les cinq cartes distribuées proviennent uniquement des familles, puis la
pioche restante mélange bien les trois types. Le schéma JSON accepte désormais
`cards.sets` et contrôle toutes les références du programme.

Validation : 2 suites et 42 tests réussis (`logs/dame-nature-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 13 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Pimp My Ride

Pimp My Ride est maintenant défini par `game.json` et son catalogue JSON. La
recette fermée conserve la pioche automatique au début du tour, l'ordre des
sept catégories, la pose et la défausse de la dernière carte piochée, les noms
de voitures attribués globalement et la victoire à trois voitures. Les pièces
de chaque voiture terminée sont conservées dans trois inventaires persistants,
ce qui maintient la vue `progress` sans état auteur spécifique.

Validation : 2 suites et 41 tests réussis (`logs/pimp-my-ride-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 14 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Le Marché des Merveilles

Le Marché des Merveilles est maintenant défini par `game.json` et un petit
catalogue JSON. Le pattern `market` porte les composants économiques, les prix,
la monnaie, les manches et le classement final. La recette `wonderMarket`
conserve achat, vente, rumeur, protection publique, vol ciblé et passe, y
compris la consommation de la protection au début de l'action suivante.

Validation : 2 suites et 41 tests réussis (`logs/wonder-market-json-final.json`),
typecheck de production, formatage ciblé, métriques et audit moteur réussis. Le
catalogue compte 15 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Tout près de Maman

Tout près de Maman est maintenant défini par `game.json` et son catalogue JSON.
La recette fermée conserve le rebond, les jetons, les cases Bond, Glissade,
Tempête, Nid et Rencontre, les chaînes bornées de cases et tous les effets des
cartes, dont les déplacements ciblés et les jets supplémentaires. L'arrivée
gagne avec trois eucalyptus ou fait reculer puis résout la nouvelle case.

Validation : 2 suites et 42 tests réussis (`logs/maman-json-final.json`),
typecheck de production, formatage ciblé et audit moteur réussis. Le catalogue
compte 16 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Cercles Sacrés

Cercles Sacrés est maintenant défini par `game.json` et un catalogue JSON de
90 cartes. La recette fermée conserve les six thèmes, la pioche avant chaque
tour, la limite de huit cartes, la défausse sans fin de tour, la formation et
le stockage public des cercles, le remplissage à six cartes et la victoire au
troisième cercle. Une initialisation JSON vide est désormais omise afin de ne
pas créer d'événements de tour ou de manche absents de la définition source.

Validation : les trois traces déterministes de référence sont strictement
identiques et les tests du jeu réussissent (2 suites, 8 tests,
`logs/cercles-parity-final.json`). Le contrat global réussit aussi pour les 39
jeux (40 tests, `logs/cercles-json-final.json`), avec typecheck de production,
formatage ciblé, métriques sans croissance ni duplication et audit moteur sans
violation. Le catalogue compte 17 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — La Grande Mine de Barbak

La Grande Mine de Barbak est maintenant défini par `game.json` et un catalogue
JSON de 81 cartes. Le programme moteur conserve la pioche et la résolution des
événements au début du tour, le domaine public, le calcul des scores, la limite
de main et les neuf effets propres à la mine. Les retraits aléatoires gardent
l'ordre historique des candidats, trésors puis objets.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript. Le test du jeu et le contrat global passent
(2 suites, 41 tests, `logs/grande-mine-json-final.json`), avec typecheck de
production, métriques sans croissance ni duplication et audit moteur sans
violation. Le catalogue compte 18 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Frousse Party

Frousse Party est maintenant défini par `game.json` et son catalogue JSON. Le
programme moteur conserve la sélection séquentielle des pions, la piste de 50
cases avec rebond, les quatre familles de cartes, les protections et altérations
de lancer, les blocages, échanges et déplacements en chaîne. Les statuts restent
publics et la forme complète des cartes tirées est préservée dans les événements.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript. Le test du jeu et le contrat global passent
(2 suites, 41 tests, `logs/frousse-json-final.json`), ainsi que le typecheck de
production, le formatage ciblé, les métriques et l'audit moteur. Le catalogue
compte 19 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Galopons ensemble

Galopons ensemble est maintenant défini par `game.json` et un catalogue JSON.
Le programme moteur conserve la sélection séquentielle des chevaux, la piste de
40 cases avec aller-retour, les pommes, les reconnaissances de dette, les
collisions, les cases bonus et repos, ainsi que les déplacements et échanges
déclenchés par les cartes.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript. Le test du jeu et le contrat global passent
(2 suites, 41 tests, `logs/galopons-json-final.json`), ainsi que le typecheck de
production, le formatage ciblé, les métriques et l'audit moteur. Le catalogue
compte 20 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Les Mains de la Terre

Les Mains de la Terre est maintenant défini par `game.json` et son catalogue
JSON de 49 cartes. Le programme moteur conserve les sept familles de six métiers,
les mains privées, les demandes de cartes, les familles complétées, les sept
cartes spéciales et leurs échanges, mélanges, pioches et statuts.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript. Le test du jeu et le contrat global passent
(2 suites, 41 tests, `logs/les-mains-json-final.json`), ainsi que le typecheck de
production, le formatage ciblé, les métriques et l'audit moteur. Le catalogue
compte 21 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Foulées fantastiques

Foulées fantastiques est maintenant défini par `game.json` et son catalogue
JSON. Le programme moteur conserve la sélection exclusive des quatre familles,
les seize pions, la piste de 52 cases, les couloirs d'arrivée, les cases sûres,
les blocages, les captures, l'entrée sur six et les tours supplémentaires.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript. Les tests du jeu et le contrat global
passent (2 suites, 43 tests, `logs/foulees-json-final.json`), ainsi que le
typecheck de production, les métriques et l'audit moteur. Le catalogue compte 22
jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Mission Galaxie

Mission Galaxie est maintenant défini par `game.json` et son catalogue JSON.
Le programme moteur conserve la piste de 50 cases, les paquets de questions,
défis et événements, les déplacements récursifs bornés, les échanges avec le
joueur le plus proche et les choix persistants de réponse ou de déplacement.
Les effets propres au jeu sont des handlers fermés du moteur.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript (`logs/mission-galaxie-parity.json`). Les
tests du jeu et le contrat global passent (2 suites, 42 tests,
`logs/mission-galaxie-json-final.json`), ainsi que le typecheck de production,
le formatage ciblé, les métriques et l'audit moteur. Le catalogue compte 23 jeux
JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — En Attendant Minuit

En Attendant Minuit est maintenant défini par `game.json` et son catalogue
JSON. Le programme moteur conserve la sélection séquentielle des six pions, la
piste de 56 cases avec rebond, les collisions, les cartes, les quiz et les
statuts de protection ou de pioche forcée. Les six effets propres au jeu restent
des handlers fermés du moteur.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript (`logs/minuit-parity.json`). Le test du jeu
et le contrat global passent (2 suites, 41 tests,
`logs/minuit-json-final.json`), ainsi que le typecheck de production, le
formatage ciblé, les métriques et l'audit moteur. Le catalogue compte 24 jeux
JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — La Bande à Banane

La Bande à Banane est maintenant défini par `game.json` et un catalogue JSON
de 60 cartes. Le programme moteur conserve les mains privées, la pioche de début
de tour, les cinq espèces, les jokers, les actions ciblées, les pièges,
l'inventaire public et l'échange aléatoire de cartes.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript (`logs/banana-parity.json`). Les tests du
jeu et le contrat global passent (2 suites, 42 tests,
`logs/banana-json-final.json`), ainsi que le typecheck de production, le
formatage ciblé, les métriques et l'audit moteur. Le catalogue compte 25 jeux
JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Ça Dérape

Ça Dérape est maintenant défini par `game.json` et son catalogue JSON. Le
programme moteur conserve les trente cases, les cartes Situation, les effets
globaux et conditionnels, les règles temporaires, les déplacements en chaîne,
les tours sans mouvement et le départage stable des arrivées simultanées.

Validation : trois parties de 300 commandes produisent exactement les mêmes
événements que la version TypeScript (`logs/derape-parity.json`). Les tests du
jeu, le test d'arrivée simultanée et le contrat global passent (3 suites, 42
tests, `logs/derape-json-final.json` et
`logs/all-declarative-after-derape.json`), ainsi que le typecheck de
production, le formatage ciblé, les métriques et l'audit moteur. Le catalogue
compte 26 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Nawak

Nawak est maintenant défini par `game.json` et son catalogue JSON. Le programme
moteur conserve les réponses secrètes simultanées, leur révélation, le vote, le
score, le renouvellement des défis et l'état persistant de la dernière manche.

Validation : trois séries de 300 commandes conservent exactement les événements
et l'état métier de la version TypeScript (`logs/nawak-parity.json`). Le test du
jeu et le contrat global passent (2 suites, 41 tests,
`logs/nawak-json-final.json` et `logs/all-declarative-after-nawak.json`), ainsi
que le typecheck, le formatage et l'audit moteur. Le catalogue compte 27 jeux JSON
sur 39 ; le point 1 reste ouvert.

### Migration JSON — Olympia

Olympia est maintenant défini par `game.json` et un catalogue JSON canonique.
Le programme moteur conserve les sept paquets, les mains privées, les divinités,
les effets ciblés, les statuts, les échanges et le calcul du prestige. Les deux
versions historiques de contenu disposent d'une migration explicite vers la
version JSON.

Validation : trois séries de 300 commandes produisent exactement les mêmes
événements que la version TypeScript (`logs/olympia-parity.json`). Les tests du
jeu et de compatibilité des snapshots passent
(`logs/olympia-json-final.json`), ainsi que le typecheck et l'audit moteur. Le
catalogue compte 28 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — Zig et Zag

Zig et Zag est maintenant défini par `game.json` et un catalogue JSON canonique
de 54 cartes. Le programme moteur conserve les piles privées, les alternances de
cartes visibles et cachées, les batailles successives, les jokers conditionnels,
le transfert des cartes et le bonus prélevé chez l'adversaire.

Validation : trois séries de 300 commandes conservent exactement le journal et
l'état métier de la version TypeScript (`logs/zig-et-zag-parity.json`). Les
tests du jeu et le contrat global des 39 jeux passent
(`logs/zig-et-zag-json-final.json` et
`logs/all-declarative-after-zig.json`), ainsi que le typecheck et l'audit moteur.
Le catalogue compte 29 jeux JSON sur 39 ; le point 1 reste ouvert.

### Migration JSON — L'Arche de Mnémosyne

L'Arche de Mnémosyne est maintenant défini par `game.json` et son catalogue de
quiz JSON. Le programme moteur construit neuf banques à partir des 469 questions
validées et conserve la configuration propriétaire, le mélange stable des
réponses, la réponse simultanée, les délais, le score et le départage.

Validation : trois séries de 300 commandes conservent exactement le journal et
l'état métier de la version TypeScript (`logs/mnemosyne-parity.json`). Les deux
tests du jeu et la frontière de contenu canonique passent (13 tests,
`logs/mnemosyne-json-final.json`), ainsi que le typecheck et l'audit moteur. Le
catalogue compte 30 jeux JSON sur 39 ; le point 1 reste ouvert.

### Point 80 — caches sans autorité métier

Les lectures qui décident d'une action utilisent désormais leur stockage
autoritatif. Un état Room est systématiquement reconstruit depuis les relations
persistées ; une valeur Redis périmée n'est plus consultée et une panne lors de
l'écriture du cache n'empêche pas de renvoyer l'état de la base. Chaque envoi,
édition ou suppression de message relit le bannissement en base. La validation
d'un jeu recharge les overrides persistés, la création d'un bot relit les noms
actifs, la validation d'une bio relit ses limites, et l'historique du chat est
reconstruit depuis le repository.

Les caches restent disponibles pour les projections publiques et les
accélérations locales, avec TTL, bornes, copies défensives et invalidation. Un
contrat ajouté à l'audit de sécurité interdit le retour de ces décisions vers
une lecture de cache. Les scénarios de cache périmé et indisponible passent avec
56 suites et 240 tests (`logs/json134-cache-truth-final.json`). Le typecheck de
production, le lint ciblé, le build de 1 760 fichiers avec chargement AppModule,
l'audit de sécurité, l'architecture et la structure passent également
(`logs/json134-cache-truth-*.log`). Point retiré après vérification.

### Point 81 — uploads bornés

Les deux surfaces d'upload écrivent les fichiers reçus sur disque. Les sons sont
limités à 250 Mio et les chunks WX à 15 Mio, avec taille totale WX validée contre
la limite d'artefact configurée. Les quotas de stockage et la réserve d'espace
libre sont vérifiés avant publication. Le débit HTTP est partagé entre instances
et refuse la requête avant que Multer n'accepte le fichier lorsque le quota est
dépassé.

Les traitements audio passent par une admission globale de deux processus et
une file de seize éléments avec délai maximal. ffmpeg/ffprobe ont un timeout,
leur sortie cumulée est limitée à 1 Mio et le processus est tué en cas de
dépassement. Le dernier chargement mémoire proportionnel au fichier a été
supprimé : le hash SHA-256 et la validation WX travaillent en flux, et une
nouvelle copie atomique publie l'audio sans `readFile`, avec contrôle de taille,
`fsync`, remplacement atomique et nettoyage du staging. L'assemblage WX était
déjà streaming, borné par le nombre de chunks, la taille attendue et un bail de
finalisation.

L'audit de sécurité verrouille ces contrats. Les scénarios upload, concurrence,
timeout, limite de sortie, capacité disque, copie atomique, WX et HTTP passent :
16 suites et 63 tests (`logs/json134-upload-bounds-green.json`). Typecheck de
production, lint ciblé, build/AppModule, architecture et structure passent aussi
(`logs/json134-upload-*.log`). Point retiré après vérification.

### Points 95 et 96 — bornes et validation runtime des entrées externes

Les requêtes HTTP JSON sont limitées à 256 Kio avant transformation puis
contrôlées par une validation globale avec whitelist stricte et refus des champs
inconnus. La garde JSON commune refuse plus de 32 niveaux, 10 000 nœuds, les
tableaux géants, les clés interdites, les accesseurs, les cycles, les nombres non
finis et les chaînes hors limite. Les WebSockets limitent aussi les octets avant
`JSON.parse` et appliquent cette garde à leurs enveloppes, y compris Presence,
Notification, Room et l'API temps réel.

La dernière passe ajoute une validation exacte des objets sans DTO : commandes
WX, réglages d'ambiance, enveloppes et données de chaque intent Room, et les sept
messages Presence. Un type Presence inconnu ne peut plus être interprété comme
un changement de contexte. Les actions Game refusent maintenant les champs
inconnus et passent par la garde structurelle avant `class-validator`. Les
fichiers, messages Redis et contenus JSON disposent de décodeurs runtime et de
limites d'octets propres. L'audit de sécurité vérifie ces points à chaque
exécution.

Validation : 45 suites et 223 tests HTTP/WS/DTO réussis
(`logs/json134-external-validation-green.json`), plus typecheck de production,
lint ciblé, audit de sécurité, architecture, structure et build/AppModule
(`logs/json134-external-validation-*.log`). Points retirés après vérification.

### Point 104 — migrations sans transactions longues

La configuration MySQL et `MigrationDataSource.runMigrations()` imposent toutes
deux le mode `none`, y compris lorsqu'un appelant tente de fournir un autre mode.
Les DDL MySQL, qui valident implicitement, ne conservent donc plus une
transaction englobante autour des reprises de données. La reprise de timeline
existante traite au plus 250 sessions par lecture et borne chaque collection à
100 000 éléments. Les migrations publiées restent immuables grâce au registre
SHA-256 ; toute correction passe par une nouvelle migration compensatoire. Le
guide `docs/operations/database-migrations.md` fixe les lots bornés, l'ordre par
clé primaire, la rejouabilité et la séparation entre reprise et changement de
schéma pour les migrations futures.

Validation : 4 suites et 8 tests de contrats, historique et migration de données
réussis (`logs/json134-migration-locks-final.json`), plus build/AppModule,
architecture, structure, lint et formatage ciblés
(`logs/json134-migration-locks-*.log`). Point retiré après vérification.

### Point 105 — retries d'infrastructure sûrs

La fabrique Redis impose désormais `maxRetriesPerRequest: 1` et
`autoResendUnfulfilledCommands: false` après les options de l'appelant : une
écriture dont l'acquittement a été perdu ne peut donc pas être rejouée
implicitement. Le pub/sub reste best-effort et échoue rapidement. Le seul retry
manuel porte sur un renommage atomique, est limité à six essais et uniquement aux
erreurs Windows transitoires. Les cinq tentatives BullMQ restent réservées aux
tâches de jeu identifiées par hash, dotées d'un `commandId` stable, journalisées
et validées par compare-and-set avant commit.

Le nouvel audit `tools/infrastructure-retry-audit.cjs`, intégré à
`quality:check`, refuse les retries Redis non bornés, la réémission implicite et
les boucles manuelles non approuvées. Validation : audit réussi, 5 suites et 41
tests de Redis, fichiers atomiques, BullMQ et automatisation réussis
(`logs/json134-safe-retries.json`), plus typecheck de production, lint, formatage,
architecture et structure (`logs/json134-safe-retries-*.log`). Point retiré
après vérification.

### Point 69 — idempotence des commandes WebSocket

La fenêtre de rejeu associe désormais l'identité de l'utilisateur, le scope, la
room, le jeu et le `requestId` à une empreinte SHA-256 canonique du type, du
payload et des rôles. Deux objets dont seul l'ordre des clés diffère rejouent la
réponse mémorisée ; un type, un payload ou des permissions différents provoquent
une collision avant l'appel du handler. Les commandes en cours ne sont jamais
évincées, les reçus terminés restent présents cinq minutes même sous saturation,
et l'identité utilisateur survit à une reconnexion. Le journal durable des
commandes Game applique aussi l'empreinte au `commandId`.

Validation : 3 suites et 27 tests d'idempotence temps réel et Game réussis
(`logs/json134-ws-idempotency.json`), avec lint, formatage et audit de sécurité
réussis (`logs/json134-ws-idempotency-*.log`). Point retiré après vérification.

### Point 70 — autorisation métier des commandes sensibles

L'audit de sécurité parcourt toutes les méthodes publiques des handlers WS et
refuse celles qui n'ont ni `requireUser` ni `requireAdmin`, hors liste publique
explicite. Ses contrats d'ownership couvrent désormais aussi les écritures Game
(`ensureWritable`), l'envoi et la réponse aux invitations Room, la sauvegarde et
la restauration Vault, la propriété des messages privés et les réponses Staff.
Les décisions reposent sur les données métier courantes : propriétaire de room,
participant ou spectateur autorisé, destinataire de l'invitation, propriétaire
du snapshot, expéditeur ou destinataire du message, et rôle Staff.

Validation : audit de sécurité réussi et 11 suites, 33 tests d'autorisation et
d'ownership réussis (`logs/json134-business-authorization.json`), plus audits
architecture et structure. Point retiré après vérification.

### Point 98 — read models dédiés

Le chemin chaud de construction du payload Room ne charge plus un agrégat
`RoomRecord` complet. `RoomPayloadService` dépend maintenant d'un port de lecture
dédié et `RoomPayloadTypeormReader` sélectionne uniquement les colonnes affichées.
Le reader sépare room, participants actifs et bots pour éviter le produit
cartésien des deux collections ; chacune est bornée à 64 lignes. Les rôles
utilisateur, métadonnées de restauration, dates internes et autres données sans
usage ne traversent plus ce chemin. Les readers dédiés existants pour sessions
actives, participants, staff, amis et classements sont désormais protégés avec
ce reader par l'audit de persistance.

Validation : 8 suites et 24 tests de read models réussis
(`logs/json134-read-models.json`), plus typecheck de production, build/AppModule,
audit de persistance, architecture, structure, lint et formatage ciblés
(`logs/json134-read-models-*.log`). Point retiré après vérification.

### Points 56, 107 et 108 — abstractions et façades utiles

Le fichier `presence-transport-limits.ts`, qui ne constituait ni un port ni une
frontière, a été supprimé. Sa constante appartient maintenant au contrat
`presence-transport.port.ts`. L'inventaire des délégations confirme que les
façades conservées ajoutent une politique concrète : contexte transactionnel
Room, validation, transformation, coordination ou frontière inter-module.
L'audit de layout refuse toute nouvelle façade hors de la courte liste examinée,
et les audits de profondeur et de structure empêchent l'empilement de couches.

Validation : layout, profondeur de services, code mort et qualité structurelle
réussis ; 2 suites et 18 tests Presence réussis
(`logs/json134-abstraction-cleanup.json`), plus typecheck de production,
build/AppModule, lint et formatage ciblés
(`logs/json134-abstraction-cleanup-*.log`). Points retirés après vérification.

### Point 109 — fichiers support, helper et manager

L'inventaire complet ne contient plus aucun de ces fichiers au-dessus des seuils
structurels. Les trois plus grands managers (publication WX, upload audio et
ambiances) restent sous 300 lignes et leurs méthodes respectent les limites de
complexité et de taille ; les helpers Room sont déjà séparés par fonction
(annonce, diff, message, heartbeat, requête, rôle et socket). Le contrôle
`structural-quality-check` analyse chaque fichier, classe, méthode et fonction et
échoue sur toute aggravation. Le contrôle de profondeur reste lui aussi conforme.

Validation : rapport qualité, audit structurel sans dette, layout, code mort et
profondeur de services réussis (`logs/json134-large-helper-quality-report.log`),
ainsi que le build/AppModule déjà validé dans le même lot. Point retiré après
vérification.
