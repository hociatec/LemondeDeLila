#pragma once

#include <cstddef>
#include <limits>
#include <string>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::domain
{
enum class GameLineKind
{
    Action,
    Info,
};

struct GameLine final
{
    static constexpr std::size_t NoAction = std::numeric_limits<std::size_t>::max();

    std::string id;
    std::string label;
    std::string detail;
    GameLineKind kind = GameLineKind::Info;
    std::size_t actionIndex = NoAction;
    bool enabled = true;
    nlohmann::json raw = nlohmann::json::object();
};
}
