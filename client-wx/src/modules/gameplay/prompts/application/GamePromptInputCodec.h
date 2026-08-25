#pragma once

#include <string>

#include <nlohmann/json.hpp>

#include "modules/gameplay/prompts/domain/GamePrompt.h"

namespace lila::modules::gameplay::application
{
struct GamePromptInputResult final
{
    bool valid = false;
    nlohmann::json value;
    std::string error;
};

class GamePromptInputCodec final
{
public:
    [[nodiscard]] static GamePromptInputResult Parse(
        const domain::GamePromptField& field,
        std::string rawValue);
};
}
