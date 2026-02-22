# Le Corridor (type Quoridor)

## But

Atteindre la rangée opposée avec son pion.

## Déroulement

- La partie se joue à 2 joueurs.
- Les joueurs déplacent leur pion à tour de rôle.
- À votre tour, vous faites une action :
  - Déplacer votre pion d’une case orthogonale (haut/bas/gauche/droite).
  - Placer un mur (horizontal ou vertical) qui bloque des passages.
- Si un pion adverse est adjacent, vous pouvez le sauter si la case derrière est libre et non bloquée ; sinon vous pouvez contourner en diagonale (règles standard).
- Un mur occupe 2 segments et ne peut pas chevaucher/croiser un autre mur.
- Un placement de mur est interdit s’il bloque totalement tout chemin vers l’objectif pour l’un des deux joueurs.

## Victoire

- Le premier joueur qui atteint la rangée opposée remporte la partie.
