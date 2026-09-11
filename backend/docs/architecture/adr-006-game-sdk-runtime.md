# ADR-006 — SDK auteur et runtime de jeu

Statut : accepté.

`game/core` porte les contrats applicatifs, la persistance et l'exécution
durable. `game/engine/runtime` porte le modèle déclaratif déterministe.
`game/engine/sdk/public-api.ts` est la façade auteur TypeScript et expose explicitement
les 81 symboles de la version 6.5. La version 3.0 retire `testGame` de la surface
de production : les tests importent `engine/testing/public-api`, qui expose
également `GameTestKit`, `GameSimulator` et `DeclarativeGameRuntime`.
La version 4.0 retire `loadGameContent`, `freezeGameContent` et `gameContentAssets` au profit de
`defineGameContent(id, source, { schema })`. Les 38 jeux et les six modèles du
générateur sont migrés. Elle ajoute `effectContent`, `effectContentSchema`,
`EffectContentReferences` et `ContentSnapshotMigration`. La composition importe
le catalogue déclaré dans `content.ts`, dont les règles dérivent leurs index.
Cette version du SDK ne change pas les versions de schéma des parties.
La version 5.0 ajoute les contrats `GameBotDefinition` et `GameRuleBindings`,
et remplace le type de classe `GameContext` par le contrat structurel auteur.
Le retrait des membres d'orchestration accidentellement accessibles est une
rupture de typage explicite. Les 38 jeux compilent avec ce contrat. Les règles
externes doivent utiliser les capacités auteur ; la reprise des effets et le
drainage d'événements appartiennent au runtime. Aucune donnée persistée ne change.
La version 5.1 ajoute `gameContract` aux vues publiques : versions du schéma
d'état, des règles et du contenu propres au jeu. Une rupture de forme de l'extension
`game` impose d'incrémenter `rulesVersion` ; une rupture de l'état auteur impose
d'incrémenter `stateVersion`. Le chargeur central refuse les snapshots incompatibles.
Les ajouts compatibles ne changent pas `viewVersion`, version du cadre de vue générique.
Les signatures et leurs dépendances sont verrouillées par `npm run sdk:contract` ;
la procédure d'évolution est décrite dans [sdk-contract.md](sdk-contract.md).
Les catalogues embarqués sont des données statiques importées ; les schémas
validant ces données sont aussi utilisés pour les releases externes.
`isRecord`, `isArrayOf`, `optionalNumber` fournissent les gardes communes.
`game/composition` ne fait que découverte, registre généré
et wiring Nest. Les jeux concrets ne connaissent ni core, ni runtime, ni Nest.

`game/shortcuts` est un petit contrat transversal de projection des raccourcis,
consommé par core et runtime. Il ne constitue ni un second SDK ni une couche
métier ; les jeux déclarent leurs raccourcis via les types exposés par
`defineGame`. Toute capacité auteur nouvelle passe par le SDK, jamais par un
import profond. L'audit interdit automatiquement ces imports et verrouille par
hash la liste complète des exports, valeurs comme types.

La V2 efface les génériques de vue après compilation tout en conservant leur
inférence dans `defineGame`. Une `viewExtension` ne produit qu'un fragment placé
sous `game`; `viewVersion`, `system`, `kits` et `effect` sont réservés. Les
événements persistés et en attente utilisent la même projection de visibilité.
Actions, choices et effects partagent le même adaptateur interne
`typedRuntimeHandler`: donnée inconnue à la frontière polymorphe, parsing par le
schéma déclaré, puis exécution typée.

`defineCardsSchema` est la voie normale pour toute déclaration directe de
deck/hand/zone. Une `CardDefinition` décrit le contenu figé. `CardInstance`
reste égale à la valeur simple par défaut et ne matérialise un identifiant et un
état d'instance que lorsqu'un jeu fournit explicitement cet état.

`GameContext` reste une façade de composition : il assemble les contrôleurs de
capacités mais délègue leur logique. `GameTurnController` reste un contrôleur de
machine de tour cohésif ; la planification des skips/extras/remplacements est
déjà isolée dans `GameTurnSchedule`. Leur réexamen ne révèle donc pas de seconde
responsabilité à extraire.

Les primitives sont admises lorsqu'elles servent plusieurs jeux ou décrivent
une opération fondamentale clairement délimitée,
restent déterministes et possèdent types, projection et tests. Le générateur
crée les quatre fichiers TypeScript, `manifest.json` et `rules.md` sous `games/*`; registre et build sont
générés. Ainsi, un jeu ordinaire ne modifie aucun fichier du moteur. Les seuils
sur `rules.ts` et `content.ts`, l'absence de cycles et la surface du SDK sont des
contrats bloquants de `quality:check`.

`game/composition` est conservé comme composition root Nest et registre de
découverte; `game/shortcuts` est conservé parce que son contrat est consommé à
la fois par le runtime et la projection WebSocket. Ce ne sont pas des reliques
parallèles. Les cinq `state.ts` et les neuf `effects.ts` spécifiques restants
sont intentionnels ; une extraction générique exige des usages réellement
équivalents ou une primitive fondamentale, pas une simple ressemblance locale.

La primitive de parcours JSON compile les opérations de cases et leurs
continuations, puis délègue les mutations à Movement, Cards, Inventory et Choice.
Elle ne connaît aucun identifiant de Panier Express. Les quiz, collections,
échanges et pions sont des capacités optionnelles validées à compilation.
Panier constitue son premier paquet de production intégralement JSON ; sa
parité est vérifiée sur les traces de l'ancien jeu. Voir le schéma JSON et le
rapport de finalisation du 11 septembre 2026 pour les preuves actuelles.

Le runtime charge uniquement les versions exactes du schéma, du contenu et des
règles attendues. Toute conversion d'un snapshot historique doit être réalisée
hors ligne avant le déploiement; aucune migration ni branche de compatibilité
n'est exécutée dans le chemin de chargement.

La revue détaillée des fichiers runtime proches des seuils et des services Room
est consignée dans `runtime-cohesion-review.md`. Elle conclut à leur cohésion
actuelle et fixe les conditions qui imposeraient une extraction future.
