# Preuve du point 525

Les paramètres de création de room ont été regroupés dans
`RoomCreateCommand`. La commande traverse désormais le service de membership,
le port vault, l’adapter public, le workflow WebSocket et la restauration de
snapshot. Les signatures ne dupliquent plus la liste `userId/gameType/name/
maxPlayers/isPrivate/invalidateCache`; le typecheck confirme la migration de
tous les appelants.
