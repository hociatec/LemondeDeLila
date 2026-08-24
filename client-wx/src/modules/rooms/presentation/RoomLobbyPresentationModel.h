#pragma once

#include <vector>

#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
class RoomLobbyNavigator;

class RoomLobbyPresentationModel final
{
public:
    [[nodiscard]] static std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildItems(
        const RoomLobbyNavigator& navigator,
        bool showRetry);
};
}
