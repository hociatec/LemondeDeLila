# Audit WPF (client-win) - "Backend First / Thin Client"

Objectif: rendre le client WPF moins "décideur" (moins de règles/heuristiques), plus "interface", avec le backend comme seule source de vérité (actions possibles, mapping choix -> action, états UI).

Date: 2026-04-16

## Où le client "décide" aujourd'hui (points clés)

Les plus gros fichiers dans `client-win/Modules/Game` (ordre ~ lignes):
- `Shell/Views/GameRoomView.xaml.cs` (~828)
- `Play/Grid/ViewModels/GridBoardViewModel.StateSync.cs` (~729)
- `Play/GamePlay/Views/GamePlayView.KeyHandling.cs` (~674)
- `Play/Session/Services/GameSession.cs` (~534)
- `Play/Actions/Services/GamePlayActionDispatcher.cs` (~524)
- `Play/GamePlay/ViewModels/GamePlayViewModel.cs` (~589) + partiels (`.Hand.cs`, `.Actions.cs`, `.Handlers.cs`)
- `Play/GamePlay/Services/GamePlayRealtimeController.cs` (~212) mais dense (déduction d'évènements via log + lifecycle)

Décisions métier / heuristiques côté client:
1. Pending -> action (mapping implicite, cas spéciaux):
   - `Play/Actions/Services/GamePlayActionDispatcher.cs`
   - Exemples: quiz (match sur texte/index + fallback payload), exchange (accepter/refuser), pawn (lecture `pending.data.moves`), etc.
2. Pending -> UI (quand afficher/masquer des choix + règles par type):
   - `Play/Choices/ViewModels/GamePlayChoicesStateSynchronizer.cs`
   - Switch implicite sur `pending.Type` (quiz/exchange/lama_*/pawn) + lecture `metadata.lifecycle.*`.
3. Génération de "choix locaux" (non demandés explicitement par le backend):
   - `Play/Choices/Services/DiscardChoiceBuilder.cs` (auto discard si pas de draw)
   - `Play/Choices/Services/AskCardChoiceBuilder.cs` (construit une matrice cible x cartes via `extras.catalog/handCards/playerViews`)
4. Déduction d'évènements à partir du log:
   - `Play/GamePlay/Services/GamePlayRealtimeController.cs` (ex: `LooksLikeResolvedDrawLog`, `LooksLikeDiceRollLog`, endgame via texte)

## Problème racine

Le backend expose souvent:
- `pending.choices: string[]` (texte)
- `state.actions: [{ type, payload }]` (actions possibles)

Mais il n'expose pas toujours un mapping canonique "ce choix correspond à telle action". Résultat: le client doit:
- recoller des indices,
- parser des textes,
- gérer des jeux/pending spécifiques,
- appliquer des fallbacks "best effort".

## Cible recommandée (thin client)

Principe: le client WPF ne doit faire que:
- afficher `state` + `pending` + `extras` + `board` + `log`,
- rendre des contrôles génériques (liste / nombre / carte / cible / texte),
- envoyer l'action fournie par le backend (type + payload) sans heuristique.

Concrètement, on vise à supprimer progressivement:
- les branches par `pending.Type` dans le client,
- les "choix locaux" (ask/discard) fabriqués côté client,
- les détections basées sur log pour déclencher de l'UI/sons.

## Changements de contrat backend à privilégier

1. Mapping explicite choix -> action (bloquant pour simplifier le client):
   - Option A (simple): `pending.data.choiceActions: Array<{ label: string; action: { type: string; payload: any } }>`
   - Option B (indexé): `pending.data.choiceActionsByIndex: Array<{ type: string; payload: any }>` aligné sur `pending.choices`.
   - Le client n'invente plus rien: il prend l'action à l'index sélectionné.

2. "UI hints" au lieu de `pending.Type` interprété:
   - Ajouter un champ stable (ex: `pending.uiKind`: `choices_list|choose_number|choose_card|choose_target|free_text`)
   - Ajouter `pending.actorId` (ou garantir `pending.playerId`) et une politique de visibilité (ex: `pending.visibility = actor_only|public`).
   - Le client n'a plus besoin de `metadata.lifecycle.viewerTurnActionable` pour décider d'afficher/masquer.

3. Evènements d'état dédiés (remplacer heuristiques log):
   - Ex: `lastRoll: { playerId, value, at }`, `lastMove: { playerId, from, to, at }`, etc.
   - Déjà fait pour la pioche via `state.lastDraw`.

## Roadmap de refacto côté client (incrémentale, compatible)

Étape 1 (safe): choix -> action canonical (réduit 80% de logique client)
- Ajouter support de `pending.data.choiceActions*` dans le client.
- Si présent: utiliser le mapping serveur.
- Sinon: garder l'ancien comportement (fallback) temporairement.

Étape 2: supprimer cas spéciaux de `GamePlayActionDispatcher`
- D'abord `quiz` et `exchange`, puis pawn/moves.
- Objectif: `TryBuildPendingChoiceAction` devient une extraction + envoi, pas un moteur.

Étape 3: déplacer "ask/discard" vers le backend
- Remplacer `AskCardChoiceBuilder` / `DiscardChoiceBuilder` par de vrais `pending` serveur (avec actions mappées).
- Le client se contente d'afficher la liste.

Étape 4: réduire `GamePlayRealtimeController` log-driven
- Remplacer `LooksLikeDiceRollLog` et autres par champs d'état dédiés (timestamps/ids).

## Quick wins (sans toucher au backend)

Même avant la migration, on peut:
- centraliser la lecture `metadata.lifecycle.*` dans un seul helper,
- réduire les "alias" d'actions dans `GamePlayCommands` (ne plus essayer action A ou B si le backend expose déjà `actions`),
- découper certains gros fichiers WPF en sous-services (UI wiring) sans ajouter de logique.

## Critère de réussite

- Le client peut être "bête" (afficher et envoyer) tout en restant utilisable:
  - aucune règle métier codée dans WPF pour un jeu spécifique,
  - pas de parsing de texte pour déclencher un comportement,
  - `pending` + `actions` du backend suffisent à tout piloter.

