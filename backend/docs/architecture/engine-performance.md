# Mesures et préparation des validateurs

Une optimisation du moteur doit présenter une mesure avant et après, la charge
utilisée et ses limites. Le passage des tests fonctionnels reste obligatoire ;
une mesure favorable ne justifie pas de contourner les contrôleurs du moteur ou
de relever un budget d'architecture. Aucun seuil temporel absolu n'est déduit
d'une exécution sur un poste partagé.

Les définitions et références statiques se compilent à la déclaration. Les
schémas d'action capturent leurs options, membres, champs et sous-parseurs à leur
création ; le parsing ne reconstitue pas la table des champs. Les descriptions
retournées restent des copies. Les fonctions personnalisées doivent rester pures,
même si la fonction de parsing a été capturée par une fabrique.

Pour mesurer une modification de schema :

1. Exécuter `node tools/game-input-benchmark.cjs before` avant modification.
2. Conserver le journal, modifier le moteur et vérifier les contrats fonctionnels.
3. Exécuter `node tools/game-input-benchmark.cjs after` dans les mêmes conditions,
   sans lancer simultanément les tests, la compilation ou un autre benchmark.
4. Comparer les sept séries et leur médiane ; conserver la somme de contrôle
   et les données utilisées. Ne pas extrapoler ce résultat à la latence serveur.

`npm run benchmark:game-engine` mesure séparément le contrat des 38 jeux après
chauffe. Les métriques de commandes, tailles d'état, projections et latences
doivent orienter le choix des prochains chemins à profiler. Un gain local ne
constitue pas une preuve d'optimisation de l'ensemble du backend.

Toute préparation doit appartenir à une définition ou à un schéma immutable ;
ne pas introduire de cache de partie global pour gagner du temps. Garder la
signature auteur et les règles des jeux indépendantes du mécanisme d'optimisation.

Pour obtenir un profil CPU d'un parcours déterministe :

```text
npm run profile:game-replay -- gerard-president 65535 64
```

Le jeu doit être installé, la graine un entier uint32 et le nombre de commandes
compris entre 1 et 256. Le profil commence après le chargement TypeScript et la
découverte des jeux. `logs/game-replay.cpuprofile` conserve les piles V8 ;
`logs/game-replay-profile.json` conserve la charge, le résultat et les trente
fonctions avec le plus de temps propre échantillonné. Ces fichiers sont remplacés
à chaque exécution : les copier avant une comparaison avant/après.

Mesure du 9 septembre : Gérard Président, graine 65535, 64 commandes, 11 680 ms
sur ce poste partagé. Les principales fonctions sont `structuredClone`
(6 557 ms propres) et `assertSerializableState` (2 681 ms). Les comparaisons JSON
du test représentent 906 ms. Le profil inclut deux exécutions, les projections
par joueur, les vérifications de non-mutation et les allers-retours JSON.
Il ne mesure pas la seule commande serveur. Une autre campagne tournait sur
le poste : ces durées servent à localiser les coûts, pas à fixer un objectif
de débit ni à annoncer un gain. Le profil brut permet d'inspecter les appelants
avant toute suppression ou mutualisation d'une copie de sécurité.
