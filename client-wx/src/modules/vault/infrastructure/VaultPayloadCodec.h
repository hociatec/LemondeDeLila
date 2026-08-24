#pragma once

#include <string>
#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/vault/domain/VaultSnapshot.h"

namespace lila::modules::vault::infrastructure::codec
{
[[nodiscard]] nlohmann::json BuildSaveRequest(int roomId);
[[nodiscard]] nlohmann::json BuildAbandonRequest(int roomId);
[[nodiscard]] std::vector<domain::VaultSnapshot> ReadSnapshots(const nlohmann::json& payload);
[[nodiscard]] std::string ReadSavedId(const nlohmann::json& payload);
[[nodiscard]] int ReadRestoredRoomId(const nlohmann::json& payload);
void ValidateDelete(const nlohmann::json& payload);
void ValidateAbandon(const nlohmann::json& payload);
}
