# Moteur indépendant des jeux — 22 septembre 2026

Le noyau ne connaît plus le catalogue applicatif : aucune dépendance directe
ou transitive vers les règles, les jeux ou leur composition, et aucune référence
à un code ou chemin de jeu dans ses 221 fichiers de production. Les 122 fichiers
JSON des jeux sont inchangés, vérification SHA-256 avant/après comprise.

## Changements

- Les 38 extensions, leurs schémas et leurs recettes spécialisées appartiennent
  à `src/game/rules`. Le noyau reçoit un catalogue privé par
  `createJsonGameCompiler`, sans enregistrement global mutable.
- Le compilateur, les champs de document, les recettes d'actions, les victoires
  et les données de vue ne maintiennent plus de liste liée au catalogue.
  Les schémas restent fermés ; données invalides, clés réservées et collisions
  de catalogue sont refusées. Une recette doit être fournie par le programme.
- La sélection de pions et sa validation de capacité appartiennent à l'extension
  de plateau. La préférence de recette du bot est fournie par l'extension.
- Le chemin et la configuration du catalogue Mnémosyne appartiennent à la
  composition applicative ; le stockage d'archives reçoit un répertoire explicite.
- Le registre généré, les outils de contenu et les tests utilisent l'entrée
  applicative `rules/public-api.ts`. Le SDK auteur reste en version 6.20.0,
  avec ses 111 fichiers de déclarations inchangés.
- Les gardes bloquent les dépendances indirectes, les identifiants de jeux,
  le retour de logique d'infrastructure et les états partagés dans les règles.
  La duplication et les limites structurelles continuent de couvrir les modules
  déplacés. Réutiliser un pack dans un deuxième jeu JSON ne demande plus de
  modifier la politique de gouvernance.

## Validation

La régression complète a exécuté **436 suites et 2 559 tests** en 1 509,341 s.
Elle a trouvé un seul échec : un vérificateur de tests refusait encore la
nouvelle entrée publique de règles. Après correction de cette frontière,
`jest --onlyFailures --runInBand` a repassé les **33 tests** de cette suite.
Le bilan consolidé est donc **436 suites / 2 559 tests validés** ; il ne s'agit
pas d'affirmer que le premier passage complet était sans échec.

Les derniers changements de projection générique et de stockage d'archives
ont également été vérifiés par **2 suites / 13 tests ciblés**. Les tests du
compilateur exécutent des extensions absentes du catalogue de production,
vérifient leurs scores, leur victoire, leur vue personnalisée, l'isolation des
catalogues et le rejet des données invalides. Un test de gouvernance ajoute un
deuxième consommateur JSON d'une règle dans un catalogue temporaire.

Les **156 simulations déterministes** couvrent 39 jeux et quatre graines :
72 parties terminent, 84 atteignent la limite prévue de 64 commandes sans
blocage. Ces résultats ne signifient pas que les 156 parties ont toutes atteint
une victoire.

Le typage, le lint, la compilation de 1 846 fichiers, le chargement de
l'AppModule compilé et `quality:check` passent. `git diff --check` est propre.
Les budgets de packs restent bloquants : 13 389 lignes de production pour un
plafond revu de 13 408, et une limite inchangée de 13 500 octets par fichier.
La hausse documentée de 64 lignes couvre les imports publics après déplacement.

## Portée

Cette évolution garantit une séparation vérifiée du noyau et des jeux. Elle
préserve les JSON, les versions de contenu et les sauvegardes existantes.
La bibliothèque extérieure contient toujours des règles spécialisées : une
mécanique nouvelle peut nécessiter une extension TypeScript, sans introduire
sa connaissance dans le noyau. La composition arbitraire de plusieurs
programmes complets n'est pas annoncée comme prise en charge.

Les empreintes, résultats et chemins des journaux figurent dans
[le rapport JSON](moteur-generique-2026-09-22.json). Le contrat durable est décrit
dans [la documentation d'architecture](../architecture/generic-engine-catalog-boundary.md).
