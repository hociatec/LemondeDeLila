# Chargement du contenu et SDK 4.0

Les jeux importent uniquement `engine/sdk/public-api` et leurs fichiers locaux.
Les tests utilisent `engine/testing/public-api`. La façade applicative de
production ne réexporte plus les outils de test.

Les 38 catalogues utilisent `defineGameContent(id, source, { schema })` dans
`content.ts`. La source embarquée et la release externe passent par le même
schéma ; les règles et la composition utilisent les données du résultat figé.
L'export normalisé peut être réimporté. `loadGameContent`, `freezeGameContent`
et `gameContentAssets` ne font plus partie du SDK auteur.

Les sources embarquées sont des objets statiques ou des modules JSON importés.
Les onze catalogues auparavant lus par des loaders sont normalisés dans
`catalogue.json` ; leurs parseurs historiques et sources remplacées sont retirés.
`isRecord`, `isArrayOf` et `optionalNumber` appartiennent au parsing du moteur.
Les gardes de cartes ou de cases restent propres au jeu.

Le pipeline est `source statique/release -> defineGameContent -> schéma du jeu
-> catalogue immuable`. Le SDK n'instancie plus de lecteur filesystem.
Le build copie les JSON nécessaires. Les lectures des releases externes passent
par `readContainedContent`, qui rejette les chemins sortants et les liens
symboliques hors de leur racine.

Les erreurs de lecture, de JSON et de collection sont des
`GameContentValidationError`. La release externe sélectionnée est prioritaire
sur la source de secours, même lorsque celle-ci est du JSON sous forme de texte.
Le décodage BOM et le parsing JSON sont communs aux sources embarquées et aux
releases externes. Le chargement reste une opération de déclaration du contenu,
à effectuer avant l'exécution des commandes de jeu.

Voyage en Terre de Brumes utilise son catalogue normalisé et les sept variantes
de Sac à Malices leurs cartes/plateaux au format 2. Les effets, réponses des quiz,
conditions de conservation et montants des taxes sont des données explicites.
Une modification d'une phrase n'est plus interprétée comme une instruction.
Les références immobilières historiques de Sac utilisent encore des noms :
leur migration vers des IDs reste nécessaire avant de considérer tout texte
comme purement présentatif.

La migration matérialise le comportement antérieur des parseurs. Elle ne
prétend pas implémenter les effets narratifs que ces parseurs ignoraient déjà.
Les schémas propres aux jeux valident leurs données déclaratives ; ils ne
choisissent plus un lecteur ou une recherche de fichiers.

Les changements de données structurées modifient leur version de contenu.
Le runtime refuse déjà un snapshot dont la version de contenu diffère : les
parties sauvegardées concernées nécessitent la politique de migration décrite
dans ADR-006 avant un déploiement. Six compatibilités explicites permettent
l'ajout des sections de Panier et d'Olympia et la normalisation JSON de quatre
autres jeux sans modifier leur état de partie. Les paires exactes sont décrites
dans [le rapport des déclarations](../quality/corrections-content-authoring-2026-09-08.md)
et [celui des sources](../quality/corrections-content-sources-2026-09-08.md).
Aucune donnée persistée n'est migrée ici.

Les audits contrôlent les imports statiques, réexports, imports de types,
`require` et imports dynamiques. Ils interdisent aussi les cycles locaux, y
compris ceux ne portant que sur des types, et `content.ts -> rules.ts`.
