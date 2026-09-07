# ADR-006 — SDK auteur et runtime de jeu

Statut : accepté.

`game/core` porte les contrats applicatifs, la persistance et l'exécution
durable. `game/engine/runtime` porte le modèle déclaratif déterministe.
`game/engine/sdk/public-api.ts` est l'unique façade auteur et expose explicitement
les 71 symboles de la version 2.1 ; les helpers de contenu et les types d'IDs
inférés ajoutés en 2.1 sont les seules extensions depuis le gel initial.
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

Les primitives sont admises seulement lorsqu'elles servent plusieurs jeux,
restent déterministes et possèdent types, projection et tests. Le générateur
crée les cinq fichiers standards d'un jeu sous `games/*`; registre et build sont
générés. Ainsi, un jeu ordinaire ne modifie aucun fichier du moteur. Les seuils
sur `rules.ts` et `content.ts`, l'absence de cycles et la surface du SDK sont des
contrats bloquants de `quality:check`.

`game/composition` est conservé comme composition root Nest et registre de
découverte; `game/shortcuts` est conservé parce que son contrat est consommé à
la fois par le runtime et la projection WebSocket. Ce ne sont pas des reliques
parallèles. Les cinq `state.ts` et les neuf `effects.ts` spécifiques restants
sont intentionnels; une extraction générique exige trois usages réellement
équivalents, pas une simple ressemblance locale.

Le runtime charge uniquement les versions exactes du schéma, du contenu et des
règles attendues. Toute conversion d'un snapshot historique doit être réalisée
hors ligne avant le déploiement; aucune migration ni branche de compatibilité
n'est exécutée dans le chemin de chargement.

La revue détaillée des fichiers runtime proches des seuils et des services Room
est consignée dans `runtime-cohesion-review.md`. Elle conclut à leur cohésion
actuelle et fixe les conditions qui imposeraient une extraction future.
