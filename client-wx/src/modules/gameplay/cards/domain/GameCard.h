#pragma once

#include <cstddef>
#include <optional>
#include <string>

namespace lila::modules::gameplay::domain
{
struct GameCard final
{
    std::string id;
    std::string label;
    std::string description;
    std::string family;
    std::string color;
    bool disabled = false;
    std::optional<std::size_t> actionIndex;
};
}
