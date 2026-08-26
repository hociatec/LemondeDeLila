#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveVaultSession = "Aucune session active pour le coffre fort.";
inline constexpr const char* VaultOperationFailed = "Operation impossible dans le coffre fort.";
inline constexpr const char* VaultPayloadInvalid = "La reponse du coffre fort est invalide.";
}
