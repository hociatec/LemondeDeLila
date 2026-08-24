#pragma once

#include <optional>
#include <string>
#include <vector>

#include <wx/string.h>

#include "modules/presence/domain/PresencePlayer.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::session::domain { struct Session; }

namespace lila::modules::presence::presentation
{
struct PresenceSocialState final
{
    bool isFriend = false;
    bool isBlocked = false;
    bool outgoingRequest = false;
    bool incomingRequest = false;
};

class PresencePresentationModel final
{
public:
    [[nodiscard]] static wxString BuildPlayerLabel(const domain::PresencePlayer& player);
    [[nodiscard]] static wxString BuildTitle(std::size_t playerCount);
    [[nodiscard]] static std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildPlayerItems(
        const std::vector<domain::PresencePlayer>& players);
    [[nodiscard]] static std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildActionItems(
        const PresenceSocialState& socialState);
    [[nodiscard]] static bool IsSelf(
        const domain::PresencePlayer& player,
        const lila::modules::session::domain::Session& session);
};
}
