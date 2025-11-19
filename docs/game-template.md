# Structure minimale commune des jeux

Pour que chaque jeu ne contienne que sa logique métier (éditeur de règles, données propres, UI spécifique) et que tout le reste soit extrait dans le moteur commun (`GameModule` + `framework-*`), on adopte la structure suivante :

## 1. Dossiers obligatoires par jeu

Chaque jeu accueille uniquement :

* **`controller/`** – les orchestrateurs métiers spécifiques (p. ex. `PanierExpressController`, `DameNatureController`) qui délèguent les actions génériques aux services partagés (`GameControllerSupport`, `GameBotController`, `GameCommandCenter`). Ils ne contiennent pas de logique réseau ni de raccourcis accessibilité spécifiques.
* **`view/`** – le Swing screen (par ex. `PanierExpressRootView`, `DameNatureScreen`, `NemesisScreen`) qui assemble les panneaux, injecte les composants partagés (`GameCommandCenter`, `StatusBannerFactory`, `NarrationQueue`, etc.) et délègue les commandes globales (`Q/X/W/F1`) vers le centre commun.
* **`model/`** – les objets métier (state, options, références) propres au jeu.
* **`service/`** – le client réseau spécifique (`RemoteClient`) et les adaptateurs indispensables au jeu.

Tout le reste (bots, narration, status, sessions, réseau, sécurité, commandes globales) vit dans :

* `framework-*` (`GameCommandCenter`, `GameBotController`, `GameRulesController`, `StatusBannerFactory`, `NarrationQueue`, `TokenAwareRealtimeGateway`, etc.)
* `java-client/client-app/src/main/java/com/lemondelila/client/game` (`GameModule`, `GamePlugin`, `GameLauncherRegistry`, `GameActionState`, `GameCommandActions`, etc.)

## 2. Template minimal d’un `GamePlugin`

1. Bind `GameCommandCenter`, `GameActionState`, `NarrationQueue`, la vue spécifique et le contrôleur.
2. Exposer les launchers via `GameLauncherBinding.of(...)` avec navigation vers l’écran (`ScreenId`).
3. Définir `onUserLoggedOut` pour réinitialiser le contrôleur/launcher.

## 3. Exemple appliqué

Pour Panier Express, Dame Nature et Mission Nemesis :

* Supprimer les helpers duplication (commandes `Q/X`, narration privée, gestion bots internalisée) et injecter le service commun `GameCommandCenter`.
* Garder uniquement la logique spécifique à chaque jeu (raffinement des règles, présentation des cartes, mapping d’état).
* Consommer les composants génériques (`GameBotController`, `GameRulesController`, `GameTableInfoController`, `GameSessionSupport`) hérités du moteur.

Cette approche garantit un socle homogène : chaque nouveau jeu ne définit que ce qui le rend unique. Si tu veux, je peux t’aider à refondre un jeu (Panier Express) selon ce template, puis appliquer la même refactorisation aux autres. Tu veux que je crée les fichiers/structures `controller/view/model/service` minimaux pour Panier Express pour démarrer ? 
