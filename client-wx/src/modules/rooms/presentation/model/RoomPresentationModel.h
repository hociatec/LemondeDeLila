#pragma once

#include <string_view>
#include <vector>

#include <wx/string.h>

#include "modules/rooms/domain/Room.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
class RoomPresentationModel final
{
public:
    enum class Action
    {
        None,
        ShowGameStatus,
        Start,
        AddBot,
        RemoveBot,
        ShowPlayers,
        ShowInfo,
        ShowRules,
        ConfigureAmbience,
        ConfigureAmbienceVolume,
        Invite,
        Kick,
        Ban,
        SetOwner,
        TogglePrivacy,
        ToggleRole,
        Save,
        Reset,
        Leave,
    };

    [[nodiscard]] static std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildItems(
        const domain::RoomState& room);
    [[nodiscard]] static wxString BuildStatus(const domain::RoomState& room);
    [[nodiscard]] static wxString BuildDetails(const domain::RoomState& room);
    [[nodiscard]] static wxString BuildPlayers(const domain::RoomState& room);
    [[nodiscard]] static Action ActionForId(std::string_view id) noexcept;
};
}
