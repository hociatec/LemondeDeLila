# Lot 1 — contrats et dépendances du moteur

Points clôturés : 1, 2, 3, 4, 5, 7, 9, 26, 28, 31, 40, 41, 42, 43, 55, 56, 57, 59, 60, 61, 62, 66, 67, 72, 73, 105, 112, 116, 121, 122, 124, 125, 126, 127, 128, 130, 135, 144, 145, 147, 148, 149, 150, 157, 159, 160.

| Point | Correction | Preuve |
| --- | --- | --- |
| 2 | Contrats `player-values` isolés ; les projections n’importent plus le kit et le kit ne réexporte plus les fonctions de projection. | `player-values-contracts.ts`, audit moteur |
| 1 | Les contrôles de dépendances du moteur détectent les cycles et la direction runtime ; l’audit est à zéro violation. | `npm run game-engine:audit` |
| 3 | Types Dice extraits dans `dice-contracts.ts`. | `dice-roll-contract.ts`, audit moteur |
| 4 | `QuizQuestion` extrait dans `quiz-content-contract.ts` ; la validation du kit ne dépend plus du contenu. | `quiz-kit.ts`, audit moteur |
| 5 | Types Scheduler extraits dans `scheduler-types.ts`. | `scheduler-contracts.ts`, audit moteur |
| 7 | Les fichiers internes de `room` n’importent plus sa propre façade `public-api.ts`. | audit architecture |
| 9 | Suppression de la navigation inverse `GameMatchEntity.players`; la relation est chargée explicitement par le repository des joueurs. | audit persistence |
| 59–62 | La compilation indexe les composants, rejette les doublons, les composants absents, les références invalides et les effets inconnus avant l’exécution. | `component-reference-validation.spec.ts`, `static-effect-references.spec.ts` |
| 66–67, 72–73 | Les versions de contenu, définition, état, règles et algorithme sont distinctes ; le chargeur applique les migrations autorisées et refuse les snapshots incompatibles. | `game-state-loader.spec.ts`, `content-snapshot-migrations.spec.ts` |
| 112, 116, 121–122, 124–126, 128, 130 | Les audits couvrent le mapping d’erreurs WS, la confidentialité des vues, la redaction des logs, la cardinalité métrique, l’arrêt propre, l’autorisation par commande, l’identité session/JWT, le rate limiting et la configuration JWT sans secret par défaut. | audits security, observability, operability |
| 43, 145, 147–150, 160 | Les audits automatisés couvrent l’absence de duplication inter-jeux, les cycles runtime, la direction des dépendances, les règles de classification, les frontières Entity/repository/public API, les exports SDK et l’ordre déterministe. | `game:duplication`, `architecture:check`, `game-engine:audit`, `sdk:contract` |
| 105 | La queue locale, le lock distribué, le CAS et les tests de concurrence définissent une exécution séquentielle par room. | `concurrency-and-state.md`, tests room-lock/command-queue |
| 127, 135 | La politique de ban est centralisée et les repositories applicatifs exposent des ports métier, sans QueryBuilder à la couche application. | `user-ban.policy.spec.ts`, audit persistence |
| 144, 157, 159 | Les règles d’extraction, l’ownership de l’état et la sérialisabilité sont documentés et contrôlés par les audits de stabilité/état. | documentation architecture, `assert-serializable-state.ts` |
| 42 | Les identifiants de jobs et de commandes automatiques utilisent un encodage déterministe typé, sans `JSON.stringify` comme identité intermédiaire. | `stable-identity.ts`, 14 tests jobs |
| 26, 28, 31 | La compilation auteur/runtime est séparée et authentifiée, la façade runtime globale supprimée au profit du SDK, et les capacités absentes de `GameContextFor` sont rejetées statiquement. | `compilation-contracts.spec.ts`, `game-context-contracts.spec.ts`, audit SDK |
| 55–57 | Les effets, conditions et cibles utilisent une grammaire discriminée canonique et un parseur commun validé avant exposition du contenu exécutable. | `effects-core.ts`, `effect-content.ts`, tests effect-content |
| 40–41 | Les cercles sacrés stockent six IDs de cartes natifs par cercle et les reconstruisent par groupes, sans JSON métier. | test `cercles-sacres`, recherche JSON ciblée |

Contrôles : `npx tsc -p tsconfig.build.json --noEmit --incremental false`, `npm run game-engine:audit`, `npm run backlog:check`.
