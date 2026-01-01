# Refactor production (roadmap)

## Objectifs
- Rendre le protocole WS plus robuste (compatibilité, feature flags, moins de “Type de message inconnu”).
- Clarifier la source de vérité des rosters (DB vs sockets) sans effets de bord.
- Séparer clairement `role` (participant/spectateur) et `visibility` (normal/hidden).

## Priorités
1. **Capabilities WS**: exposer `api.capabilities` et faire consommer côté client (évite les appels à des routes non supportées).
2. **Unifier `silent`/`hidden`**: garder `hidden` uniquement (laisser un alias temporaire puis supprimer).
3. **Payload builder unique**: un service dédié qui construit `RoomPayload` (counts/players/spectators) pour:
   - broadcast normal
   - réponse ciblée (ex: admin hidden)
4. **Règles roster**:
   - définir ce que `players` représente (participants DB vs connectés),
   - définir ce que `counts.players` représente,
   - éviter les merges “ad hoc” dans le gateway.
5. **Contrats admin**:
   - `admin.rooms.list` doit expliciter les filtres (joinableOnly, includePrivate, includeStarted),
   - éviter de réutiliser `rooms.public.list` pour l’admin.

## Tests / Observabilité
- Ajouter des tests unitaires sur le builder de payload roster.
- Log structuré sur `roomId`, `userId`, `hidden`.
- Metrics sur `ws.route.unknown`, `admin.rooms.*`.

