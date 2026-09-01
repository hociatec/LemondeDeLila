#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GameInputDescriptor final
{
    std::string key;
    std::string type;
    std::string label;
    std::string description;
    std::string initialText;
    bool optional = false;
    bool integer = false;
    bool multiple = false;
    std::optional<double> minimum;
    std::optional<double> maximum;
    std::vector<GameValue> choices;
    std::vector<GameInputDescriptor> properties;
};

struct GameActionDescriptor final
{
    std::string type;
    std::string label;
    std::string description;
    std::string documentation;
    std::string control;
    bool confirm = false;
    bool paginatedCandidates = false;
    std::optional<GameInputDescriptor> input;
};
}
