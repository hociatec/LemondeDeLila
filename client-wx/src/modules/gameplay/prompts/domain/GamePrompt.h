#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

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
    bool integer = false;
    std::vector<nlohmann::json> choices;
    nlohmann::json schema = nlohmann::json::object();
};

struct GamePrompt final
{
    std::string title;
    std::string label;
    std::string actionType;
    std::string cancelActionType;
    std::vector<GamePromptField> fields;
};
}
