#pragma once

#include <string>

#include <wx/string.h>

#include "modules/gameplay/domain/GameState.h"

namespace lila::modules::gameplay::presentation::info
{
class GameInfoTextBuilder final
{
public:
    [[nodiscard]] static wxString Build(
        const domain::GameState& state,
        const std::string& panelId,
        const wxString& selectedLineDetail);
};
}
