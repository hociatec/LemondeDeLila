# Accessibilité du jeu Dame Nature

## Principes directeurs
- **Compatibilité lecteur d'écran (WCAG 2.1 §4.1.3)** : chaque changement d'état important (tour, sélections, journaux, pollution) déclenche maintenant une mise à jour de l'`AccessibleContext` et une annonce via `NarrationQueue`, équivalent Swing d’une région ARIA live.
- **Navigation clavier complète (WCAG 2.1 §2.1.1)** : toutes les actions critiques disposent d’un raccourci documenté (piocher, cibler, demander, répondre aux quiz, rouvrir la configuration). Les nouveaux raccourcis « lecture » permettent d’obtenir à la demande un résumé verbal (main, quiz, historique, pollution, aide).
- **Ordre de focus prévisible (WCAG 2.1 §2.4.3)** : la configuration conserve un ordre linéaire (↑/↓) et annonce automatiquement les consignes lorsque l’écran s’ouvre. Le gameplay conserve un focus unique et des commandes vocalisées pour réduire les déplacements inutiles.
- **Redondance texte + audio (guidelines WAI-ARIA pour jeux)** : toutes les zones critiques (main, adversaires, quiz, historique) restent visibles tout en possédant un nom/description accessible mis à jour dynamiquement.

## Parcours recommandé pour les lecteurs d'écran
### Écran de configuration
1. L’écran annonce automatiquement : « Flèches haut/bas pour choisir, gauche/droite pour modifier, Entrée pour lancer, Échap pour revenir à l’accueil ».
2. Chaque ligne (« Nombre d’adversaires », « Cartes danger », « Quiz nature ») est focusable, change visuellement de bordure et décrit oralement sa valeur actuelle.
3. `Entrée` lance la partie, `Échap` retourne à l’accueil.

### Écran de jeu
- Le focus reste sur le panneau principal ; toutes les commandes se font au clavier. `Tab` amène au journal et `Maj+Tab` en ressort.
- Les zones « Main », « Adversaires », « Familles », « Quiz » et « Historique » sont lues sur demande (sélectionnez la zone ou utilisez les raccourcis ci-dessous).
- Chaque changement (tour, sélection, résultat d’action) est lu automatiquement grâce au `NarrationQueue`.

## Raccourcis utiles
| Touche | Action annoncée |
| --- | --- |
| `Espace` | Piocher une carte.
| `↑ / ↓` | Choisir l’adversaire précédent/suivant.
| `← / →` | Choisir la carte précédente/suivante à demander.
| `E` | Demander la carte sélectionnée.
| `R` | Actualiser immédiatement la partie.
| `T` | Annoncer le tour en cours.
| `S` | Répéter la sélection courante (adversaire + carte).
| `H` | Lire la composition de votre main.
| `L` | Lire le dernier événement du journal.
| `Q` | Lire la question et les choix du quiz actif.
| `P` | Annoncer le nombre de jetons pollution restants (alerte automatique quand il en reste 2 ou moins).
| `1` à `9` | Répondre au quiz en sélectionnant l’option correspondante.
| `F1` | Relire toutes les commandes clavier disponibles.
| `C` / `Échap` | Rouvrir la configuration depuis la partie.
| `Tab` / `Maj+Tab` | Entrer ou quitter la zone « Historique ».

## Conseils d’utilisation
- Pour un rappel rapide de l’état courant, pressez `S` (sélection) puis `P` (pollution) et `L` (dernier événement).
- Avant de répondre à un quiz, pressez `Q` pour entendre question et réponses, puis utilisez `1…9`.
- Si vous perdez le fil des commandes, `F1` renvoie l’intégralité du mémo vocalement et met à jour le statut visuel.

Ces ajustements s’alignent sur les recommandations W3C pour les jeux accessibles : décrire chaque interaction, offrir un retour synthétique, assurer la disponibilité clavier et proposer des rappels contextuels à la demande.
