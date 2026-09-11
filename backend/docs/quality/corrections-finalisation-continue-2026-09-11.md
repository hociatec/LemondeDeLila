# Finalisation continue du snapshot courant

Le chantier part de 43 points ouverts et se termine avec zéro point restant.
Les preuves ci-dessous concernent
exclusivement le snapshot courant. Les anciens rapports ayant réutilisé des
numéros ne servent pas de preuve pour ce snapshot.

## Clôtures vérifiées

| Point | Correction et preuve |
| --- | --- |
| 131 | Les attentes et fallbacks des jeux passent par Choice/Submission. Le seul timeout déclaré dans les jeux est la pause LAMA, configurée avec `strategy: first` dans Choice. Aucun timer ou fallback parallèle dans les jeux. Tests des continuations, bornes, votes et workflows de soumission exécutés avec succès. |
| 134 | Les prédicats structurels répétés des cinq catalogues Maman, Pirates, Mission Galaxie, Mon Village et Voyage sont remplacés par les schémas communs `gameInput` et `effectContentSchema`. Les validations propres aux destinations et réponses restent dans leurs catalogues. Le mode numérique sans coercition et le rejet des champs inconnus sont testés. |
| 135 | Les cartes de neuf jeux portent directement leurs instructions : Panier, Contes, Grande Mine, Frousse, Les Mains, Minuit, Ballons, Galopons et Ça Dérape. Suppression des tables et générateurs parallèles. Comparaison des données canoniques avant/après réussie pour les neuf jeux. Les tests négatifs de `canonical-card-effects` et `json-board-schema` refusent les effets manquants et les références inconnues. |
| 163 | Les TTL restants des sessions Redis et de la déduplication des notifications sont nommés à leur point de définition. Les autres TTL utilisent les paramètres opérationnels, les configurations validées ou les constantes des verrous concernés. Le test de déduplication vérifie la borne d'expiration et l'absence de prolongation par un doublon ; les tests du stockage de session passent. |

## Autres points du snapshot

| Point | Correction ou vérification et preuve |
| --- | --- |
| 19 | Schéma JSON 1 formalisé : composants, setup, phases, actions, patterns, victoire, effets, conditions et cibles. Objets fermés et références validées par `json-game-schema`, `effect-json-schema`, `json-game-compiler` et leurs tests. Le périmètre accepté et les champs refusés sont documentés dans `docs/architecture/json-game-authoring.md`. |
| 112 | Panier Express est un paquet JSON complet : aucun TypeScript de production, 40 cases, 58 cartes, 30 quiz, six pions. Trois traces de 150 commandes reproduisent les événements métier historiques ; une partie complète se termine en 1 048 commandes. Audits `panier:effects`, `panier:wiring`, `panier:surface` et tests `panier-json-parity`. |
| 114 | Revue des gros fichiers et des séquences répétées ; extractions et motifs de conservation consignés dans `revue-mecaniques-finales-2026-09-11.md`. Inventaire des sources, audits de duplication, métriques et structure. |
| 116 | Initialisations standard migrées vers les composants et `sequentialPawnSelection.setup`. Les dix setups restants ont chacun une responsabilité spécifique décrite dans la revue des mécaniques ; tests de sélection et scénarios des jeux. |
| 121 | Seuils de victoire décrits par `thresholdVictory`, arrivées par les patterns ou opérations JSON. Les évaluations conservent leur moment métier. Tests `threshold-victory`, jeux concernés et parcours JSON complet. |
| 122 | Pipeline `completeRound` partagé par six jeux ; clôture de quiz et cycle économique spécifiques conservés dans leur orchestration. Revue des mécaniques et tests des manches, soumissions et jeux. |
| 124 | Filtres d'identité remplacés par `players.others` ; sélections et classements utilisent Players/targets/ranking. Les filtres de disponibilité ou de composition sont des critères métier. |
| 125 | Choix de cartes via Choice/Submission, y compris les échanges JSON ; validation d'options, participants et continuations centralisée. Tests des choix, soumissions et Panier. |
| 126 | `drawEvent`/`drawAndResolve` remplacent les séquences identiques ; le tirage de plusieurs cartes avant défausse conserve son ordre propre. Tests de recettes, recyclage, replays et jeux. |
| 127 | Échanges délégués à Economy/Inventory/Cards/Ownership, dont les échanges de Panier compilés depuis les bindings JSON. Aucun inventaire secondaire créé ; tests des kits et scénarios d'échange. |
| 128 | Suppression des doublons de mutation ; les checks restants sélectionnent une action légale, un fallback ou une absence d'effet. Revue ciblée de Sac, Galopons, Contes, Primalis et Marché. |
| 129 | Suppression des checks répétés dans Olympia et Gérard ; Cards/Inventory vérifient l'appartenance lors de la mutation. Les validations d'actions légales et d'échange différé sont conservées et testées. |
| 130 | Déplacements réalisés par Movement et ses recettes ; suppression des wrappers standard de Minuit/Mission. Les arrivées et branches spécifiques restent explicites. Tests de mouvement, scénarios et replays. |
| 136 | Identifiants de composants, cartes, quiz, patterns, effets et choix de plateau contrôlés à compilation. Tests de collisions de `compilation-contracts`, `component-reference-validation` et `json-board-schema`. |
| 137 | Graphe des phases et références statiques d'actions/effets/components validés avant exécution ; les données des effets personnalisés sont parsées sans exécuter le resolver. Les références calculées dans un callback TS restent contrôlées par les kits à l'exécution : elles ne sont pas assimilées à des références statiquement analysables. |
| 143 | Règles déterministes sans I/O externe ; contenu chargé avant compilation, événements en mémoire puis commit transactionnel de session. Audits d'import et de séparation runtime, tests du command executor et des contrats d'exécution. |
| 147 | Ordre explicite des joueurs, classements, règles automatiques et requêtes SQL. Pagination du catalogue et de la reprise par clé ; tris temporels complétés par l'identifiant. |
| 148 | Départage explicite des rankings, cartes triées et résultats SQL. Les rankings refusent participants dupliqués et critères non finis ; tests `ranking-kit` et repositories. |
| 153 | Séquences/versions de diffusion, ordre des états et identité de restauration contrôlés dans la projection realtime. Tests `game-ws-broadcast-order`, `game-ws-realtime-state` et contrats de tâches. |
| 156 | Vues client et read models construits en whitelist. Tests de `game-system-view`, `game-kit-view`, `room-roster-projection`, visibilité et projection des repositories. |
| 157 | Secrets filtrés par Visibility et les vues des kits, pas par des champs de vue parallèles des jeux. Suppression d'anciennes projections inutilisées ; tests mains, soumissions, dés et événements privés. |
| 159 | Reçus de commandes, compare-and-set, identité de job et déduplication des notifications rendent les relivraisons sans double mutation. Tests executor, scheduler, task-contract, request-replay et notification-dispatch. |
| 161 | Les ports exposent des records/read models et les événements des payloads explicites. Audits de frontières ORM et tests de projection ; le reader de reprise ne renvoie que `roomId`/`gameType`. |
| 162 | Reprise durable SQL vers BullMQ ajoutée : le commit de session est l'intention relisible, balayée par pages au démarrage puis périodiquement. Tests de panne, réémission, isolation, pagination et arrêt. Garanties détaillées dans `game-automation-delivery.md`. |
| 164 | Pub/Sub limité aux notifications et rafraîchissements ; les commandes automatiques sont réémises depuis SQL. Inbox SQL pour les notifications durables ; tests de reprise et contrats de tâches. |
| 165 | Présence par origine, séquences, heartbeat, expiration et reconnexion. Suites `presence-origins`, `presence-heartbeat`, `presence-state` et handlers WS. |
| 166 | Uploads bornés, validation de contenu et publication atomique ; tests `wx-update-upload`, stockage audio et `atomic-file.utils`, audits sécurité et opérabilité. |
| 173 | Autorisations dans les cas d'usage et handlers sensibles ; tests des mutations chat, messagerie, vault, bots et WS. L'audit de sécurité vérifie les frontières d'entrée. |
| 174 | Identité authentifiée appliquée par le mapper de commande, sans préférence donnée à un `userId` client. Tests `game-ws-command.mapper`, handlers de présence/room et politiques de mutation. |
| 178 | Bornes JSON communes de taille/profondeur/valeurs, nombres finis et validation des champs par schéma. Le format auteur fermé refuse nombres textuels et champs inconnus ; tests `json-input-limits`, payload validators, schémas JSON et capture des handlers. |
| 180 | Readers et ports de projection pour les consommateurs ; requêtes bornées et ordre stable. Le nouveau reader de reprise évite de charger les entités complètes dans la liste. Tests de projection SQL et audits de persistance/contrats. |
| 185 | Suppression des bindings pass-through, du manager de maintenance audio et des wrappers standard de setup/statut/déplacement. Imports adaptés ; tests audio, recettes et jeux. |
| 186 | Ancien helper d'event log découpé en buffer d'événements, patch d'état et timeline ; maintenance audio séparée en diagnostic, nettoyage et recherche de source. Les autres helpers restants ont un objet précis. |
| 187 | Continuations et opérations du plateau en unions discriminées ; les deux dernières assertions non-null de production ont été remplacées par des gardes. Inventaire AST : zéro `NonNullExpression` de production. Les assertions d'initialisation des propriétés ORM ne sont pas des accès non-null. |
| 189 | Conventions conservées : `null` pour une absence explicite dans une vue/record, `undefined` pour un champ optionnel ou une mise à jour omise. Les sorties de diagnostic audio déclarent leurs champs nullables ; tests des projections, serializers et repositories. |
| 191 | Chaque extraction repose sur des usages équivalents ou une primitive fondamentale. Le plateau JSON ordonne arrivées/continuations et délègue les mutations ; un test minimal sans les capacités de Panier vérifie cette indépendance. Revue des mécaniques et ADR-006. |
| 198 | Passe d'exports : 43 déclarations sans consommateur supprimées dans les jeux, puis nettoyage des imports et fonctions devenus inutiles. Inventaire `completion-removed-exports.json`, audit noUnused et vérification des références supprimées. SDK public et migrations conservés. |
| 199 | Revue des propriétaires d'état : les jeux utilisent les kits pour cartes, positions, ressources, manches et choix. Les états spécifiques restants représentent leurs règles propres. Contrats backend-debt, vues génériques et scénarios des 39 jeux. |
| 200 | Capture des handlers/schémas, contenu canonique, ordre stable indépendant de la locale, sérialisation et replays. Versions de règles augmentées là où nécessaire ; snapshots incompatibles refusés. Tests de loader, migrations, événements, horloge et traces Panier ; contrat SDK 6.5.0 verrouillé. |

## Changements de compatibilité

La passe de code inutilisé supprime aussi six fichiers orphelins, dont une
ancienne constante SDK 4.0. Le relais `json-game-loader` est supprimé : le
registre généré importe directement le compilateur JSON public.

- Patterns JSON fermés, validation des collisions et références des composants.
- Validation des données des effets personnalisés à la compilation, sans
  exécution de leur resolver.
- Capture des callbacks et schémas des actions, choix et effets : modifier les
  options originales n'altère plus les handlers déjà construits.
- Classements communs, départages explicites et suppression de wrappers.
- Versions de règles courantes après correction : Contes, Ça Dérape, Minuit,
  Mission Galaxie, LAMA, Jeu de l'Oie, Aventure, Mon Village et Panier en version 2 ;
  Voyage en version 3. Les snapshots incompatibles sont refusés avant mutation.
- Le calcul des étiquettes de contenu utilise l'ordre des clés indépendant de
  la locale. Une ancienne étiquette différente n'est pas acceptée silencieusement.
- Suppression des initialisations déléguées aux primitives existantes pour
  Contes, Foulées et La Parade Sucrée.
- L'ancien audit des Quatre Vents, qui cherchait des services supprimés et
  interprétait les textes des cartes, vérifie les 17 définitions compilées.
  Il conserve les contrôles des 80 cartes de Ça Dérape et des dimensions
  56 + 6 d'Odyssée.

## Validation

Les résultats sont enregistrés dans `logs/completion-*.json`. Les suites se
recoupent ; leurs nombres ne doivent pas être additionnés. Le journal
`completion-full-tests-intermediate.json` conserve une exécution intermédiaire
ayant lu le compilateur pendant son découpage ; ce n'est pas la preuve finale.

Validation finale réussie :

- **308 suites Jest, 1 583 tests réussis**, aucun échec ni test ignoré :
  `logs/completion-full-tests.json`.
- Typage TypeScript complet et ESLint sur les fichiers modifiés :
  `logs/completion-final-typecheck-lint.log`.
- `npm run quality:check` : contrôles de backend, persistance, sécurité,
  architecture, structure, SDK, contrats WS et gouvernance réussis. Les baselines
  d'architecture et de structure restent vides ; aucun seuil n'a été relevé.
- Dix audits complémentaires réussis, dont code inutilisé, structure des
  contenus et les trois contrôles Panier : `logs/completion-extra-audits.json`.
- `npm run build` : 39 jeux enregistrés, 1 670 fichiers compilés et chargement du
  `AppModule` compilé réussi : `logs/completion-build.log`.
- Après clôture, `corrections-backlog-check` et `backlog-governance-check`
  confirment **zéro point ouvert**. Le log global qualité précède cette dernière
  synchronisation ; le résultat courant est dans
  `logs/corrections-backlog-reconciliation.json`.

Les changements ont été appliqués au projet, sans déploiement ni migration SQL
sur une base réelle. Les statistiques de room restent explicitement en best
effort et ne participent pas au commit ni à la victoire ; la reprise durable
ajoutée concerne les automatismes des parties.
