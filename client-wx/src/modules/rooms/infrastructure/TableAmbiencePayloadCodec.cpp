#include "modules/rooms/infrastructure/TableAmbiencePayloadCodec.h"

#include <utility>

#include <nlohmann/json.hpp>

namespace lila::modules::rooms::infrastructure
{
std::vector<domain::TableAmbience> ReadTableAmbiencesResponse(std::string_view rawJson)
{
    const auto payload = nlohmann::json::parse(rawJson, nullptr, false);
    std::vector<domain::TableAmbience> result;
    if (!payload.is_object()) return result;
    const auto items = payload.find("items");
    if (items == payload.end() || !items->is_array()) return result;
    for (const auto& item : *items)
    {
        if (!item.is_object() || item.value("enabled", true) == false) continue;
        domain::TableAmbience ambience;
        ambience.soundId = item.value("soundId", std::string{});
        ambience.name = item.value("name", std::string{});
        if (!ambience.soundId.empty() && !ambience.name.empty())
            result.push_back(std::move(ambience));
    }
    return result;
}
}
