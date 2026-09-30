#pragma once

#include <string>

#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::application
{
struct GamePromptInputResult final
{
    bool valid = false;
    domain::GameValue value;
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
