# La Parade Sucrée !

## Objectif
Posez vos cartes dans l’ordre (2→As) et collectez les friandises des cases spéciales. Le joueur qui possède le plus de valeur de friandises lorsque toutes les cartes sont jouées gagne.

## Mise en place
1. Mélangez le deck complet (2,3,4,5,6,7,8,9,10,V,J,D,R,A) et distribuez toutes les cartes entre les joueurs en mode "round robin".
2. Chaque joueur reçoit une réserve initiale de friandises : 1 Chamallow (valeur 1), 1 Chocobon (valeur 5), 1 Balisto (valeur 10).
3. Placez la séquence sur le tapis : la prochaine carte attendue commence à `2`.

## Déroulement d’un tour
1. `play_card` : si vous possédez la carte suivante (par exemple `3` après `2`), posez-la sur le tapis. Vous pouvez enchaîner tant que vous avez la carte attendue.
2. Les cartes spéciales (7, 10, Valet, Dame, Roi) vous font remporter la récompense associée (voir tableau ci-dessous) et vous permettent de continuer si vous avez la carte suivante.
3. `pass` : lorsque vous ne pouvez plus placer la carte suivante, passez le tour au joueur suivant.

### Récompenses des cartes spéciales
- 7 : Farou le Farceur → 1 Chocobon (valeur 5)
- 10 : Roland le Roi du Carnaval → 1 Chamallow (valeur 1)
- Valet : Dimitri le Bouffon → 2 Chamallows
- Dame : Daniella la Reine du Bal → 3 Chamallows
- Roi : Fabien le Capitaine → 4 Chamallows

## Équivalence des friandises
Si vous n’avez pas exactement la friandise demandée pour une case, vous pouvez utiliser une friandise de valeur supérieure et récupérer la différence (affinage automatique dans le moteur de jeu).

## Fin de partie
La partie s’arrête quand toutes les cartes ont été posées. Celui qui possède le plus de valeur en friandises (Chamallow=1, Chocobon=5, Balisto=10) est roi du Carnaval.
