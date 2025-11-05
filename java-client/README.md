# Java Client - MVC Scaffolding

Ce commit ajoute un scaffolding MVC strict pour le client Swing (Java 11).

Principes:
- Chaque jeu implémente une triade MVC: model / view / controller
- GameCatalog / GameFactory pour découvrir et enregistrer des jeux
- GameManager pour gérer le cycle de vie et l'affichage central
- ApiClient: wrapper HTTP asynchrone (java.net.http + Jackson)
- Découverte: resources/games.json + fallback ServiceLoader

Comment ajouter un jeu:
1. Créer un package `com.lemondedelila.client.games.<yourgame>` contenant:
   - model: extends GameModel
   - view: implements GameView
   - controller: implements GameController and (optionally) GameFactory
2. Enregistrer votre GameFactory via code (catalog.register(myFactory)) ou ajouter une entrée dans resources/games.json
3. Utiliser GameManager.launch(gameId) pour démarrer le jeu
