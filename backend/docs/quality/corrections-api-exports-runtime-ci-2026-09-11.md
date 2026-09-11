# Réexports métier et contrôle CI du runtime

## Point 197 : origine réelle des exports

Le contrôle des API publiques suit les symboles TypeScript jusqu'à leurs
déclarations. Un fichier intermédiaire, un alias, un export de type, un export
par défaut ou un namespace ne peut plus cacher un réexport d'infrastructure.
Les namespaces sont parcourus avec détection des symboles déjà visités.

Le contrôle porte sur les symboles réellement exportés : sélectionner un
contrat neutre dans un fichier qui exporte également de l'infrastructure reste
autorisé. Les entrées `composition-api.ts` conservent leur rôle de composition
Nest. Aucune exception ni augmentation de baseline n'a été ajoutée.

## Point 195 : graphe complet et exécution CI

Le graphe du runtime compte aussi les dépendances `require()` et
`import = require()`. Les tests démontrent le rejet d'un cycle et d'une
dépendance indirecte vers le compilateur cachés par ces syntaxes.
Le runtime actuel est acyclique, imports de types inclus, et les points
d'exécution contrôlés n'atteignent pas le compilateur.

Le nouveau workflow `.github/workflows/backend-architecture.yml` exécute les
tests des garde-fous, les contrôles des frontières, la séparation du runtime
et la disposition des sources. Il couvre les pushes et pull requests touchant
le backend, ainsi que le lancement manuel. Les actions sont épinglées aux SHA
vérifiés de leurs versions v7 ; leurs paramètres suivent les documentations
[checkout](https://github.com/actions/checkout) et
[setup-node](https://github.com/actions/setup-node).

L'installation utilise le lockfile et désactive les scripts d'installation :
ce job effectue uniquement de l'analyse statique, sans démarrer l'application,
Redis ou MySQL. Il utilise Node 24 et des permissions de lecture du dépôt.

## Validation

- `npm run architecture:test` : 31 tests passent.
- `architecture:check`, `runtime:separation:audit`, `layout:audit` et
  `governance:audit` passent.
- Le YAML du workflow est parsé avec succès.
- Le workflow est ajouté au projet ; son exécution hébergée sur GitHub reste
  à observer après publication des changements. Aucune règle distante de
  protection de branche n'a été modifiée.

Seuls les points 195 et 197 sont retirés de la liste courante `corriger.txt`.
