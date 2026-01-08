# Jeux de grille (framework)

Le client WPF affiche automatiquement une **grille interactive** (clavier + lecteur d’écran) dès qu’un état de jeu expose `extras.grid`.

## Contrat backend → client

Dans `exposeStateForUser`, ajouter dans `extras` :

- `grid.kind`: `"grid"`
- `grid.size`: taille N de la grille (N×N)
- `grid.blockedEdges`: objet `{ "x,y": { n: boolean, e: boolean, s: boolean, w: boolean } }`
  - `true` signifie “mur / bord / passage bloqué”
- `grid.cellActions`: objet `{ "x,y": [ { type, label, payload } ] }`
  - `label` est lu par le lecteur d’écran dans la case (important)
- `grid.statusLines`: tableau de chaînes (annonces d’état courtes)

Optionnel :
- `board.positions`: `{ "playerId": index }` (index = `y*size + x`) pour placer des pions “génériques” côté client.

Exemple vivant : `backend/src/game/games/vents-infinis/corridor/presenter/corridor-presenter.service.ts`.

## Règles d’accessibilité côté client

- Chaque case est un bouton focusable : les flèches parcourent la grille.
- L’annonce d’une case inclut : coordonnées, contenu (pion/vide), murs autour, et actions disponibles (`cellActions[].label`).
- Entrée sur votre pion : “prendre / reposer”.
- Entrée sur une case cible : envoie l’action correspondante ; si plusieurs actions, une boîte “liste de choix” apparaît.
- Pour les murs avec 2 orientations, une boîte “Horizontal / Vertical” apparaît.

Implémentation côté client : `client-win/client-win/Modules/Game/Play/ViewModels/GamePlayViewModel.cs` + `client-win/client-win/Modules/Game/Play/ViewModels/GridCellViewModel.cs`.

