#pragma once

#include <cstddef>
#include <optional>
#include <string>

namespace lila::modules::gameplay::domain
{
struct GameDie final
{
    std::string id;
    std::string label;
    int sides = 6;
    std::optional<int> value;
    bool disabled = false;
    std::optional<std::size_t> actionIndex;
};
}
