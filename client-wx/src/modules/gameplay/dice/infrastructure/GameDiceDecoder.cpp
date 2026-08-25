#include "modules/gameplay/dice/infrastructure/GameDiceDecoder.h"

#include <string>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<int> PositiveInt(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    if (found == object.end() || !found->is_number_integer()) return std::nullopt;
    const int value = found->get<int>();
    return value > 0 ? std::optional<int>(value) : std::nullopt;
}

std::optional<std::size_t> Index(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    if (found == object.end() || !found->is_number_integer()) return std::nullopt;
    const auto value = found->get<long long>();
    return value >= 0 ? std::optional<std::size_t>(static_cast<std::size_t>(value)) : std::nullopt;
}

std::string Text(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_string() ? found->get<std::string>() : std::string{};
}
}

std::optional<domain::GameDiceState> GameDiceDecoder::Decode(const nlohmann::json& extras)
{
    if (!extras.is_object()) return std::nullopt;
    const auto raw = extras.find("dice");
    if (raw == extras.end() || !raw->is_object()) return std::nullopt;

    domain::GameDiceState state;
    const auto label = Text(*raw, "label");
    if (!label.empty()) state.label = label;
    state.total = PositiveInt(*raw, "total");
    state.rollActionIndex = Index(*raw, "rollActionIndex");
    state.rollKey = Text(*raw, "rollKey");

    const auto dice = raw->find("dice");
    if (dice != raw->end() && dice->is_array())
    {
        state.dice.reserve(dice->size());
        for (std::size_t position = 0; position < dice->size(); ++position)
        {
            const auto& item = (*dice)[position];
            if (!item.is_object()) continue;
            domain::GameDie die;
            die.id = Text(item, "id");
            if (die.id.empty()) die.id = "die-" + std::to_string(position + 1);
            die.label = Text(item, "label");
            if (die.label.empty()) die.label = "Dé " + std::to_string(position + 1);
            die.sides = PositiveInt(item, "sides").value_or(6);
            die.value = PositiveInt(item, "value");
            die.disabled = item.value("disabled", false);
            die.actionIndex = Index(item, "actionIndex");
            state.dice.push_back(std::move(die));
        }
    }

    if (state.dice.empty() && !state.total.has_value() && !state.rollActionIndex.has_value())
        return std::nullopt;
    return state;
}
}
