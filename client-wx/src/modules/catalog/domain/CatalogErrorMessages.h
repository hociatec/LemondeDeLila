#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveCatalogSession = "Aucune session active pour le catalogue.";
inline constexpr const char* CatalogLoadFailed = "Chargement du catalogue impossible.";
inline constexpr const char* CatalogPayloadInvalid = "La reponse du catalogue est invalide.";
}
