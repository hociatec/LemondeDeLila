# Contract fixtures

Ces fichiers décrivent des exemples de payloads échangés entre le client Java et le backend.
Ils servent de “snapshots” humains pour éviter les divergences lors des refactors.

Règles
- Le backend reste la source de vérité (`backend/CONTRACT.md`).
- Les fixtures doivent rester minimales et stables (champs obligatoires + cas limites).
- Quand le contrat change, mettre à jour les fixtures en même temps que le code.

Fichiers
- `game.state.setup.json` : état non démarré (setup) avec `turn.label` “table créée”.
- `game.state.started.json` : état démarré (started) avec `turn.label` “C’est à X de jouer”.
- `room.payload.json` : exemple de `RoomPayload` minimal (room + joueurs + bots).
