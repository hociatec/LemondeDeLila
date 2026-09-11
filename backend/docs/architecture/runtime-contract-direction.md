# Dépendances internes du moteur

Le runtime ne définit plus le contrat auteur par introspection de sa propre
classe. `GameContextCapabilities` assemble les contrats de joueurs, lifecycle,
valeurs, composants, interactions, scheduling et effets. La classe `GameContext`
implémente ce contrat ; les types auteur ne l'importent pas.

Les contrats de commandes de tour, configuration et effets sont explicites.
Les opérations de reprise, de drainage, de debug et d'orchestration de phases
restent privées au runtime. Les autres capacités utilisent des vues structurelles
des API publiques des kits, sans constructeur ni stockage privé.

Les modèles ont des responsabilités distinctes :

- `contracts/author-rule-contracts.ts` : actions, choix et callbacks de règles ;
- `contracts/pattern-definition.ts` : fragments de définition des patterns ;
- `contracts/definition-validation.ts` : données nécessaires aux validateurs ;
- `contracts/effect-ir.ts` et `effect-resolver.ts` : instructions et résolveurs ;
- `state/declarative-state.ts` : état persistant de la partie ;
- `contracts/turn-runtime-state.ts` : données minimales nécessaires aux tours ;
- `definitions/game-definition-contracts.ts` : contrat de définition compilée.

Les builders d'actions et de choix vivent dans `actions/action-builders.ts`.
Les recipes les utilisent directement, sans importer le compilateur de jeux.
Les effets utilisent également l'adaptateur typé de cette couche d'actions.
Les réexports existants sont conservés pour les consommateurs du SDK.

`tools/runtime-dependency-graph.cjs` contrôle les imports de production, y compris
les imports de types, imports dynamiques, alias TypeScript et réexports. Il refuse
les cycles ainsi que les chemins partant des points d'entrée d'exécution vers le
compilateur, le validateur de définition ou les builders de patterns et recipes.
Ses tests sont intégrés à `architecture:test` ; le contrôle est également utilisé
par `runtime:separation:audit`. Aucun cycle historique n'est autorisé par baseline.

Cette refonte ne constitue pas encore une séparation complète entre langage
auteur et IR compilée : `GameDefinitionInput` reste dérivé du contrat compilé,
et ce dernier conserve les métadonnées de patterns. Ces deux travaux restent
suivis séparément dans le backlog.
