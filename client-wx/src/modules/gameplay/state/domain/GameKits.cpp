#include "modules/gameplay/state/domain/GameKits.h"

#include <string_view>

namespace lila::modules::gameplay::domain
{
namespace
{
const nlohmann::json Empty;
}

const nlohmann::json& GameKits::Get(const char* capability) const
{
    const std::string_view id(capability == nullptr ? "" : capability);
    if (id == "cards") return cards;
    if (id == "dice") return dice;
    if (id == "grid") return grid;
    if (id == "movement") return movement;
    if (id == "pawns") return pawns;
    if (id == "score") return score;
    if (id == "resources") return resources;
    if (id == "counters") return counters;
    if (id == "status") return status;
    if (id == "inventory") return inventory;
    if (id == "economy") return economy;
    if (id == "ownership") return ownership;
    if (id == "collections") return collections;
    if (id == "quiz") return quiz;
    if (id == "submissions") return submissions;
    return Empty;
}

bool GameKits::Has(const char* capability) const
{
    const auto& value = Get(capability);
    return !value.is_null() && !value.empty();
}
}
