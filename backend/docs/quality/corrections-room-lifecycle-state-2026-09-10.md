# Preuve des points 528–530

La room expose maintenant une projection discriminée `RoomLifecycleState`
(`open`, `started`, `finished`) via `resolveRoomLifecycleState`. Les politiques
de membership utilisent cette projection unique au lieu de recomposer des
combinaisons indépendantes de `status` et `startedAt`. Les tests couvrent les
états ouverts, démarrés, terminés et la combinaison incohérente
`status=finished` avec `startedAt` présent, normalisée en `started`.

Les points 528, 529 et 530 sont clôturés après typecheck et tests ciblés.
