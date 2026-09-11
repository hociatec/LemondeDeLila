# Preuve du point 532

Les erreurs de transport `RoomWs*` ont été sorties du domaine et placées dans
`infrastructure/presentation/ws/room-ws.errors.ts`. Les politiques
d’application utilisent désormais `room-domain.errors.ts`, qui ne contient
aucune référence au protocole WebSocket. L’audit d’architecture et le
typecheck passent après cette séparation.
