#pragma once

#include <string>

namespace lila::modules::gameplay::domain
{
struct GameCard final
{
    std::string id;
    std::string label;
    std::string description;
};
}
