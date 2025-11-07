# Mission Nemesis

## Presentation

Mission **Nemesis** est un affrontement spatial tactique pour deux a quatre
commandants. Chaque joueur positionne secretement sa flotte dans une
nebuleuse instable, puis tente de localiser et neutraliser les vaisseaux
ennemis. La victoire revient au premier commandant qui detruit la flotte
adverse.

## Materiel virtuel

- Grille de 10 x 10 secteurs partagee par tous les joueurs.
- Cinq vaisseaux par joueur :
  - Station spatiale (5 cases)
  - Trou noir stabilise (4 cases)
  - Asteroide defensif (3 cases)
  - Satellite longue portee (3 cases)
  - Sonde de reconnaissance (2 cases)

## Mise en place

1. Chaque joueur positionne l'integralite de sa flotte sur la grille sans
   chevauchement, horizontalement ou verticalement.
2. Une fois toutes les flottes placees, la partie passe en phase **Combat**.
3. Le joueur 0 (ordre d'inscription dans la salle) commence.

## Tour de jeu

1. Le joueur actif choisit des coordonnees cibles (`x`, `y`) et declenche un
   tir.
2. Le systeme annonce "Touche" si l'une des cases choisies correspond a un
   segment de vaisseau encore intact, sinon "Manque".
3. Une fois le tir enregistre, le tour passe au prochain joueur encore en
   lice.

## Victoire

Un joueur est elimine des que toutes les cases de ses vaisseaux sont touchees.
La partie se termine immediatement lorsque tous les adversaires d'un joueur
ont ete elimines. Ce joueur est declare vainqueur.

## Actions disponibles

| Action             | Payload attendu                               | Effet                                                         |
|--------------------|-----------------------------------------------|---------------------------------------------------------------|
| `place_ships`      | `{ ships: [ { name, coords:[{x,y},...] } ] }`   | Definit la flotte du joueur pendant la phase de placement.    |
| `fire`             | `{ coordinates: { x, y } }`                   | Tir simple contre l'adversaire suivant.                       |

## Rappels

- Les coordonnees sont exprimees avec `x` et `y` compris entre `0` et `9`.
- Aucun vaisseau ne peut etre place en diagonale.
- Aucun tir ne peut etre rejoue aux memes coordonnees par le meme joueur.
