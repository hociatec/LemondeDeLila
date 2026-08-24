#pragma once

#include <optional>
#include <string>
#include <vector>

namespace lila::modules::gameplay::domain
{
struct GamePromptField final
{
    std::string key;
    std::string label;
    std::string kind;
    std::string initialText;
    std::optional<int> minimum;
    std::optional<int> maximum;
};

struct GamePrompt final
{
    std::string title;
    std::string label;
    std::string actionType;
    std::vector<GamePromptField> fields;
};
}
