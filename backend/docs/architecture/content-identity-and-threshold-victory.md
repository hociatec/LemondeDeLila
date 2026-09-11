# Identité du contenu et victoires par seuil — contrat SDK 6.1

## Sauvegardes

La compilation calcule `CompiledGameDefinition.contentDigest` en SHA-256 à
partir de l'identifiant du jeu, du format et des données de contenu. Les clés
des objets sont triées selon un ordre indépendant de la locale. Les tableaux,
Maps et Sets conservent leur ordre et disposent de marqueurs de type distincts.
Les libellés de version restent inchangés pour conserver le registre des
migrations existantes.

Le runtime inscrit cette empreinte dans `engine.contentDigest` à la création
du snapshot et la contrôle à la restauration, avant l'exécution des règles.
Réutiliser une version déclarée avec des données différentes provoque une
erreur de compatibilité ; le snapshot source reste intact. Le calcul du hash
ne fait pas partie de chaque mutation : il intervient à la compilation.

Une sauvegarde ancienne sans empreinte est refusée par le runtime courant,
sauf si une migration explicite relie sa version de contenu à une version
différente de destination. Cette déclaration engage la compatibilité des
données et ne doit être ajoutée qu'après vérification du contenu historique.
Une migration d'algorithme moteur ne peut pas modifier l'empreinte de contenu.

Pour reprendre un snapshot incompatible, conserver l'artefact applicatif et
la release de contenu d'origine, ou implémenter une migration vérifiée. Aucun
archivage automatique de runtimes historiques n'est ajouté par cette passe.
Le déploiement de ce changement doit donc tenir compte des parties anciennes
encore actives ; il ne faut pas effacer leur snapshot pour contourner le rejet.

## Victoires par seuil

`thresholdVictory` accepte une condition `score-at-least` ou
`resource-at-least`, un montant positif et des options déclaratives :

- `participants`: `active` par défaut, ou `all` ;
- `selection`: `all-qualified` par défaut, `unique-qualified` (aucun gagnant
  tant que plusieurs joueurs sont qualifiés), ou `highest-value-lowest-id` ;
- `reason`: motif de fin, sinon le nom de la condition.

Le schéma fermé de `game.json` accepte les mêmes options. Les noms de politiques
inconnus sont rejetés à compilation. Olympia conserve son meilleur score puis
le plus petit identifiant ; Nawak conserve le calcul de tous les qualifiés et
sa prolongation en cas d'égalité. Le déclenchement de ces calculs reste au même
moment de leur manche qu'avant la refactorisation.

Cette primitive a trois usages : le compilateur JSON, Olympia et Nawak.
Elle ne remplace pas les conditions de victoire spécifiques ni les autres
mécaniques encore à migrer.

Le contrat de déclarations SDK passe de 6.0 à 6.1 : deux exports publics sont
ajoutés (`thresholdVictory`, `ThresholdVictory`) et les définitions compilées
portent l'empreinte. Les références de surface publique et de déclarations
ont été actualisées ensemble. La constante de version du protocole SDK
historique reste indépendante de cette version de déclarations.
