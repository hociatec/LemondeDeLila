# Gouvernance des extensions de règles JSON

## Frontière du moteur

Le noyau vit dans `src/game/engine`. Les 38 extensions de l'application, leurs
schémas et leurs recettes spécialisées vivent dans `src/game/rules`.
Le compilateur reçoit un catalogue privé par injection ; il n'importe ni ce
catalogue, ni les jeux, ni leur composition. Le garde `engine:boundary:audit`
vérifie les dépendances directes et transitives, y compris les types, réexports
et alias. Il refuse aussi les codes et chemins de jeux dans les littéraux du
moteur, y compris son infrastructure. Voir le
[contrat de séparation](generic-engine-catalog-boundary.md).

Les primitives génériques restent dans les contrats, kits, effets, patterns et
recettes du noyau. Les fichiers autorisés de `runtime/recipes/gameplay` sont
explicitement recensés. La sélection générique de cartes conserve son contrat
dans `runtime/contracts/card-selection-contract.ts`.

## Catalogue et réutilisation

Chaque extension possède son contrat sérialisable `program.ts`, sa clé JSON,
son schéma, sa compilation, ses actions, ses handlers et sa validation.
Le registre applicatif est explicite, ordonné et figé ; il ne découvre aucun
fichier au runtime. `rules/public-api.ts` fournit le compilateur configuré au
registre des jeux. Les documents de jeu portent les associations de leurs
parametres aux operations disponibles.

Les domaines sont `board`, `cards`, `choice`, `collection`, `race` et `spatial`.
La valeur historique `scope: 'generic'` désigne une contribution au protocole
commun ; elle ne prouve pas que sa mécanique convient à tout jeu. La bibliothèque
regroupe des familles de mecanismes parametrables, exterieures au moteur.
Le bilan de reconfiguration est decrit dans
[les mecanismes parametrables](parameterized-game-mechanisms.md).

Le rapport recalcule les consommateurs réels, les lignes de production et de
comportement, les lignes par consommateur et la preuve de réutilisation.
`designed` indique un seul jeu ; `demonstrated` indique plusieurs jeux.
Ajouter un deuxième consommateur JSON ne nécessite aucune modification du
moteur ou de la politique : un test réalise cette opération dans un catalogue
temporaire. Une extension enregistrée sans consommateur reste refusée.

Chaque programme d'au moins 300 lignes utilisé par un seul jeu exige une revue
comparative. Une revue existante reste conservée lorsque plusieurs jeux
réutilisent le programme. Les ressemblances structurelles entre extensions sont
analysées par AST et doivent être extraites ou explicitement justifiées. Les
imports d'implémentation entre extensions restent interdits : les éléments
réutilisables remontent vers les primitives du noyau.

## Budgets et contrôles

Les 38 programmes representent 1 201 lignes de contrats. Leurs repertoires
comptent 13 583 lignes de production, dont 76 de metadonnees, soit 13 507
lignes de comportement. Les plafonds correspondent a ces mesures apres revue
des nouveaux descripteurs configurables et de leurs interpreteurs. La limite
par fichier reste 13 500 octets. Aucun programme supplementaire n'est ajoute.
Les schemas et recettes exterieures aux repertoires des packs restent soumis
aux controles structurels globaux.

`quality:check` conserve les contrôles des cycles, limites du DSL, références,
immutabilité, isolation, sérialisation, versions, migrations, snapshots,
déterminisme, RNG, atomicité, propriété de l'état et frontières publiques.
