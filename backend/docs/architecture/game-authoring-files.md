# Fichiers auteur du SDK

Le sens des imports est contrats/constantes, puis contenu, puis règles, puis
composition. Les imports TypeScript de types suivent aussi cet ordre. Un fichier
auxiliaire ou un réexport ne permet pas de contourner une frontière.

`types.ts`, `state.ts`, `constants.ts` et `content-types.ts` décrivent les contrats
et les identifiants. Ils ne chargent pas le catalogue et ne dépendent pas des règles.

`content.ts` assemble et valide le catalogue immuable. Ses auxiliaires peuvent
parser des données et vérifier des références. Ils ne dépendent pas des règles
qui exécutent les tours de jeu.

`rules.ts` et ses fichiers spécialisés portent les décisions particulières du
jeu. Les opérations réutilisables appartiennent aux kits, recettes et patterns du
SDK. `bot-rules.ts` choisit une action métier en utilisant le contexte et les actions
autorisées ; il ne dépend pas de `game.ts`.

Les types de données partagés sont exportés depuis `types.ts` ou `state.ts`,
jamais depuis `rules.ts` : l'auditeur contrôle les déclarations et réexports
explicitement typés. Les alias de contexte privés restent possibles. Les actions,
effets, prédicats et recettes SDK configurées pour ce jeu appartiennent aux règles ;
les catalogues statiques appartiennent au contenu et les opérations techniques
ou mécaniques génériques au SDK.

La cible de `game.ts` est la composition : manifeste, contenu, composants,
patterns, règles, callbacks et présentation. Une fonction qui décide quoi faire
pendant une partie appartient aux règles ; le fichier de composition la référence.
Les fonctions de mise en place sont dans `setup-rules.ts`, les configurations
dans `configuration.ts`, et les choix, effets, hooks et projections dans
`rule-bindings.ts`. Les transformations de métadonnées statiques et les délégations
directes restent permises dans le fichier de composition. L'auditeur interdit
les constructeurs de règles exécutables et les décisions inline utilisant le
contexte de partie dans `game.ts`.

## Évolution additive du SDK — 9 septembre 2026

`GameBotDefinition<TState, TActions>` est un nouvel export de type. Il reprend
exactement le contrat auparavant inline de `definition.bot`, sans changer les
actions possibles, leur payload ou le contexte. Il permet de typer un bot séparé
sans importer le runtime. `GameRuleBindings<TState, TViewExtension>` expose les
types des groupes de règles séparés, sans élargir les champs de vue autorisés.
La surface passe de 75 à 77 exports ; l'empreinte
de l'auditeur a été mise à jour pour ces ajouts explicites. Les 75 noms antérieurs
restent disponibles.

`resourceIds` déclare les ressources créées après setup, sans initialiser de solde
ni lancer de manche. Les ressources présentes dans `initialization.resources`
sont déclarées implicitement. La compilation vérifie les références des effets,
conditions, marchés et collections. `GameResourceIdOf` conserve les identifiants
littéraux déclarés via le builder typé.
