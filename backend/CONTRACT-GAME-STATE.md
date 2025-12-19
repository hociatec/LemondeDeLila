# Contrat WebSocket `/ws/game` (event `game.state`)

Le serveur est la source de vérité. Le client doit afficher l'état tel quel et renvoyer les actions proposées (même `type` / `payload`).

## Envelope WS

```json
{ "type": "game.state", "payload": { /* GameStateWithActions */ } }
```

## Schéma (vue d'ensemble)

Champs communs (base moteur) :
- `status: string` (`open|started|finished|...`)
- `phase: string`
- `round: number`
- `turnIndex: number`
- `lastRoll: number | null`
- `log: Array<{ message: string; timestamp?: string }>`
- `players?: Array<{ id: number; username: string; isBot: boolean; shoppingList: any[]; basket: any[]; inventory: any[] }>`
- `turn?: { currentPlayerId: number | null; direction: 1 | -1; skippedPlayerIds?: number[]; label?: string }`
- `pending?: null | { type: string; playerId?: number|null; targetPlayerId?: number|null; blocking?: boolean; question?: string|null; choices?: string[]; data?: object }`
- `metadata?: object` (peut contenir `actionLog`)

Champs exposés au client générique :
- `actions?: Array<{ type: string; label?: string; payload?: object }>`
- `extras?: object` (spécifique au jeu : vues joueur, raccourcis, etc.)
- `catalog?: { phases: string[]; victory: any }` (si le jeu l’expose)

Notes :
- Le serveur n’expose pas forcément `board`. Quand absent, le client doit rester fonctionnel (annonces/affichage en mode dégradé).
- `turn.label` est le texte prêt à annoncer/afficher pour le tour courant (serveur source de vérité).

## Exemples

### PanierExpress (extrait)

```json
{
  "status": "started",
  "phase": "turn",
  "round": 1,
  "turnIndex": 0,
  "lastRoll": null,
  "turn": { "currentPlayerId": 12, "direction": 1, "label": "C'est à Alice de jouer." },
  "actions": [{ "type": "draw", "label": "draw", "payload": {} }],
  "pending": null,
  "extras": {
    "currentPlayerView": { "id": 12, "username": "Alice", "shoppingList": [], "basket": [], "inventory": [] },
    "shortcuts": [{ "key": "pressed S", "type": "interface", "id": "shopping" }]
  },
  "metadata": { "actionLog": [{ "actorId": 12, "type": "draw", "payload": {}, "timestamp": 1730000000000 }] }
}
```

### DameNature (extrait avec pending quiz)

```json
{
  "status": "started",
  "phase": "turn",
  "round": 2,
  "turnIndex": 1,
  "turn": { "currentPlayerId": 34, "direction": 1, "label": "C'est à Bot 1 de jouer." },
  "actions": [{ "type": "answer_quiz_correct", "label": "answer_quiz_correct", "payload": {} }],
  "pending": { "type": "quiz", "question": "Quiz", "choices": ["Bonne réponse", "Mauvaise réponse"], "playerId": 12 },
  "extras": { "hand": [], "books": [], "shortcuts": [{ "key": "pressed C", "type": "interface", "id": "hand" }] }
}
```

