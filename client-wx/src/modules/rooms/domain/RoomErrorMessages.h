#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveRoomSession = "Aucune session active pour les tables.";
inline constexpr const char* RoomLobbyLoadFailed = "Chargement des tables publiques impossible.";
inline constexpr const char* RoomConnectionFailed = "Connexion à la table impossible.";
inline constexpr const char* RoomPayloadInvalid = "La reponse de la table est invalide.";
}
