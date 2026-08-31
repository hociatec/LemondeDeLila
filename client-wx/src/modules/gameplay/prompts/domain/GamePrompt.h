#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GamePromptField final
{
    std::string key;
    std::string label;
    std::string kind;
    std::string initialText;
    std::optional<double> minimum;
    std::optional<double> maximum;
    bool optional = false;
    bool integer = false;
    bool multiple = false;
    bool ordering = false;
    int minimumSelections = 0;
    int maximumSelections = 0;
    std::vector<GameValue> choices;
};

struct GamePrompt final
{
    std::string title;
    std::string label;
    std::string actionType;
    std::string cancelActionType;
    bool paginatedCandidates = false;
    std::vector<GamePromptField> fields;
};
}
