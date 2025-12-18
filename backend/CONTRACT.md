# Contrat client/serveur (état unifié)

Objectif : tout client reste générique. Le serveur est la seule source de vérité et expose intégralement l’état, les actions possibles et les pending.

## Schéma d’état exposé (`GameStateWithActions`)
- Champ `status` + `turn` + `players` + `log` issus du moteur.
- Champ `turn.label` (si présent) : libellé prêt à afficher pour le tour courant (serveur source de vérité).
- Champ `actions`: tableau d’objets `{ type: string; label?: string; payload?: object }` prêts à être renvoyés tels quels.
- Champ `pending`: objet décrivant l’attente en cours (ou `null`).
  - Quiz : `{ type: "quiz", question, choices: string[], playerId }`
  - Vote : `{ type: "vote", name?: string, day?: number }`
  - Échange : `{ type: "exchange", playerId?, targetPlayerId?, payload? }`
  - Phase/étape : `{ type: "phase", name, day?: number }`
- Journal structuré : `metadata.actionLog` (si présent) contient des entrées `{ actorId, type, payload?, timestamp, step? }`.

## Attentes côté client
- Affiche les `actions` listées et renvoie au serveur l’action choisie (même type/payload).
- Affiche le `pending` pour guider l’utilisateur (quiz, vote, échange, phase).
- Ne contient aucune logique métier : pas de calculs de règles, pas d’actions supplémentaires.

## Attentes côté serveur
- Valide et applique les actions, avance les phases, résout la partie.
- Remplit systématiquement `actions` et `pending` pour le joueur courant.
- Conserve un log texte (`log`) et, si besoin, un journal structuré (`metadata.actionLog`).
