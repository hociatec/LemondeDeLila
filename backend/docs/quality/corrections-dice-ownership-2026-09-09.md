# Résultats de dés et valeurs propres aux règles

Les résultats bruts et les résultats sélectionnés par une politique de lancer
appartiennent à `GameDiceController` et à son stockage générique. La revue des
38 jeux ne trouve aucun état auteur contenant une seconde collection de dés.

Deux chemins de résolution utilisaient néanmoins une copie du résultat :

- Foulées Fantastiques recopiait le total dans la continuation d'un choix de pion.
  Cette copie est supprimée ; la résolution relit `ctx.dice.last('main')` et
  refuse de continuer si le lancer manque. Un ancien champ `roll` conservé dans
  une sauvegarde est ignoré.
- Odyssée des Quatre Cieux utilisait `value.roll` pour décider du tour
  supplémentaire. Cette décision lit maintenant le composant de dés. Le champ
  du DTO de choix est conservé pour la compatibilité des choix déjà envoyés ;
  il constitue une projection, pas une seconde autorité sur le résultat.

Les autres valeurs conservées ne représentent pas le même fait : Ça Dérape
stocke par joueur un résultat effectif pouvant provenir d'un miroir et être
doublé après consommation d'un statut. Contes conserve le résultat proposé dans
un choix de relance après remplacement éventuel du 1 par 4. Ces valeurs ne peuvent
pas être remplacées par le lancer brut sans modifier les règles. Elles restent
dans les composants génériques de ressources ou de choix, sans collection locale
de dés dans l'état auteur. Les totaux présents dans les événements sont historiques.

Les tests vérifient le tour supplémentaire depuis le lancer canonique, y compris
avec une ancienne copie contradictoire, ainsi que le replay. Les quatre jeux
concernés passent leurs sept tests ; les 39 contrôles transversaux couvrant les
38 jeux passent également. Aucun changement de version de snapshot n'est requis :
la forme des choix déjà émis reste acceptée.
