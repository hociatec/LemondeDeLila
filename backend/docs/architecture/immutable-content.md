# Contenu statique immuable

`defineGameContent` valide et copie les données avant de les exposer aux règles.
Le gel descend aussi sous les objets déjà gelés. Les références partagées sont
préservées à l'intérieur d'une copie, et l'empreinte du contenu reste inchangée.

`Map` et `Set` utilisent une vue de lecture sur une collection privée. Les
mutateurs directs et les mutateurs empruntés aux prototypes échouent. Les
itérateurs et `forEach` exposent uniquement les valeurs gelées ; leur paramètre
collection reste la vue protégée. Les références conservées vers la collection
source ne permettent pas de modifier la copie compilée.

Conserver le résultat de `freezeGameContent(value)` : une collection ou un objet
déjà scellé peut nécessiter un remplacement. Les objets ordinaires modifiables
sont gelés en place. Pour recomposer du contenu, utiliser `defineGameContent` ou
les constructeurs de catalogues : leur copie interne conserve les collections.
`structuredClone` refuse les vues protégées ; une copie native ne doit pas perdre
silencieusement leurs entrées. Une copie explicite par `new Map(view)` ou
`new Set(view)` reste possible et indépendante, avec des éléments encore gelés.

La matérialisation des cartes produit des copies modifiables indépendantes du
catalogue ; l'état persistant conserve les identifiants de cartes. Cette
correction ne change ni les empreintes de contenu ni le format des snapshots.
