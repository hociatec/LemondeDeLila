# Vérification des points restants — 22 septembre 2026

Les résultats ci-dessous correspondent à la première intervention. Voir la
[poursuite des corrections](dette-suite-2026-09-22.md) pour les défauts SLO,
les 12 alertes livrées jusqu'au webhook et les vérifications supplémentaires.
La [finalisation](dette-finalisation-2026-09-22.md) remplace les mesures de taille
historiques ci-dessous : le plafond initial de 13 344 lignes est désormais respecté.

Périmètre : les sept entrées restantes de `backend/dette.txt` au début de cette
intervention. Les corrections déjà présentes dans l'espace de travail ont été
conservées. Le texte initial est archivé dans le fichier JSON compagnon.

| Point | Résultat livré | Vérification et limite |
| --- | --- | --- |
| 2 | Nouvelle vérification du bail après les lectures asynchrones et avant toute suppression/replanification du recovery. L'arrêt et le drainage interrompent également ces opérations. | Tests de perte de bail pendant la lecture et de shutdown. Les quatre consommateurs de baux sont identifiés : recovery, maintenance, publication WX et upload WX. Les mutations SQL utilisent leurs contrôles de version ; les artefacts WX conservent leur verrou de volume. |
| 3 | Propriété SQL durable pour la maintenance, unique entre hôtes et sans expiration. Transfert au processus de commande pour conserver l'exclusion après HTTP 202 ; libération conditionnelle au jeton exact après terminaison. | Tests concurrents avec deux connexions MySQL et un vrai processus enfant. Aucun remplacement automatique d'un ancien propriétaire : après crash, récupération manuelle coordonnée. Les écritures WX exigent toujours un volume/verrou partagé. Le bail Redis lui-même reste un bail, pas un fencing token universel. |
| 12 | Campagne déterministe de tous les jeux ajoutée à la CI ; contrats, invariants et replays validés après factorisation. | 39 jeux, quatre graines (0, 1, 17, 65535), jusqu'à 64 étapes par scénario. Cela réduit le risque sans prouver toutes les combinaisons possibles : la complexité métier est intrinsèque. |
| 13 | Cinq gros composants répartis par responsabilité : cartes et pouvoirs, effets globaux de déplacement, demandes de choix, configuration des phases, présentation et bots. Constructeurs d'actions/effets sans entrée et contrat `EffectCard` mutualisés. | Contrats des jeux, replays, typage et audits de structure. Nouveau plafond de 13 500 octets par fichier de production des effect packs. Recalibrage global explicite décrit ci-dessous. |
| 41 | Le callback complet du worker BullMQ passe par `shutdown.run()`. Audit AST bloquant pour les nouveaux workers, y compris les imports aliasés. | Tests d'admission refusée après arrêt et de drainage des callbacks acceptés ; audit testé contre les callbacks non suivis et le contournement par `cleanup=true`. |
| 61 | Index SQL couvrant des sessions à reprendre, pagination par clé et budget contrôlé après chaque ligne. | 5 201 lignes réelles dont 201 actives ; `EXPLAIN` utilise `idx_game_sessions_recovery`. Vérification de la pagination, des changements de statut et migration aller/retour/aller. Le scan reste proportionnel aux sessions actives et une I/O en cours peut dépasser le budget. |
| 63 | Compteur de pertes de baux, alerte, sept panneaux Grafana supplémentaires et tests Prometheus sur pertes, reprise bloquée, quarantaine et saturation mémoire. | Règles et scénarios validés avec le vrai `promtool` 3.5.0. Le texte initial s'arrête à « monitoring nécessaire » : son périmètre complet reste à préciser. Aucun déploiement de monitoring ni test d'acheminement d'alertes en production n'est revendiqué. |

## Preuves exécutées

- Suite générale après les changements moteur/recovery/worker/métriques : **428 suites, 2 502 tests réussis**, 909,925 secondes. Journal local `dette-final-jest.log`.
- Dernier complément maintenance après le transfert de propriété : **4 suites, 18 tests réussis**, dont les commandes interrompues par timeout ou signal (`dette-admin-complete.log`). Ces nombres recouvrent certains tests de la suite générale ; ne pas les additionner comme des tests distincts.
- MySQL 9.1 isolé sur `127.0.0.1:33307`, bases temporaires créées puis supprimées par les tests : **44 migrations**, historique, données existantes, transactions et plans SQL vérifiés (`dette-migrations.log`). Aucun changement de la base applicative.
- `tools/debt-mysql-integration.cjs` : exclusion entre connexions, jeton erroné refusé, échec de commande, retour arrière interdit sous verrou, processus enfant et index de recovery (`dette-mysql-final.log`). Le même test est intégré au lanceur des intégrations réelles de CI.
- Prometheus 3.5.0 : validation de 11 règles d'alerte et quatre règles SLO ; les cinq groupes de scénarios `lila-alerts.test.yml` passent.
- Contrat SDK revu en **6.19.0**, ajouts compatibles de constructeurs vides et prise en compte de l'option `automaticBots` déjà présente ; aucune migration de snapshot.
- Compilation TypeScript/SWC et chargement du module compilé réussis (`dette-build-complete.log`).
- `npm run quality:check` complet réussi : architecture, structure, persistance,
  sécurité, shutdown, observabilité, invariants, contrats de jeux/SDK et gouvernance
  (`dette-quality-complete.log`). `git diff --check` ne signale aucune erreur.
- Lint complet réussi après correction du formatage (`dette-lint-verified.log`).

Le fichier historique `corriger.txt`, absent de l'arbre reçu alors que ses deux
audits le requièrent, est rétabli vide conformément au registre historique vide.
Ses six tests de gouvernance passent ; les points de `dette.txt` restent dans
leur propre registre et ne sont pas confondus avec ces anciens identifiants.

Les journaux sont locaux et ignorés par Git ; les scripts, assertions et scénarios
permettant de les reproduire sont versionnés. La campagne de jeux produit aussi
`logs/game-replay-campaign-results.json` (39 jeux × quatre graines).

## Revue des budgets de taille

L'arbre reçu comptait 13 642 lignes de production d'effect packs pour un plafond
historique de 13 344 ; le contrôle était déjà en échec. Après extraction et
mutualisation, le total est 13 614. Le plafond a été recalibré à cette valeur
mesurée (comportement : 13 538), sans marge supplémentaire. **L'ancien plafond
global n'est donc pas atteint.** Le plafond des programmes reste à 1 110 lignes
(mesure : 1 105). Le nouveau plafond de 13 500 octets par fichier empêche le retour
des concentrations de 14–16 Ko traitées ici. Ce choix est inscrit dans
`tools/engine-effect-pack-governance.json` et ne constitue pas une suppression
de la complexité métier ni une preuve d'absence de toute dette.

## Mise en service et limites

Appliquer les migrations `1790035200000` et `1790035300000` avant ce backend.
Suivre [la procédure d'exploitation](../operations/automation-recovery.md) pour
les propriétaires orphelins, le partage des ressources WX et le monitoring.
Les alertes et panneaux doivent encore être chargés dans l'environnement cible.

Le point 63 tronqué et l'ensemble infini des combinaisons métier ne peuvent pas
être certifiés « 100 % » par ces tests. Le registre distingue les corrections
vérifiées des risques intrinsèques et du périmètre encore inconnu.
