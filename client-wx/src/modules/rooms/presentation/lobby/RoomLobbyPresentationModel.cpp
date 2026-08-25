#include "modules/rooms/presentation/lobby/RoomLobbyPresentationModel.h"

#include "modules/rooms/presentation/navigation/RoomLobbyNavigator.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
std::vector<lila::shared::ui::controls::VerticalMenuItem> RoomLobbyPresentationModel::BuildItems(
    const RoomLobbyNavigator& navigator,
    bool showRetry)
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    if (showRetry) return {Item{"retry", wxString(L"R\u00E9essayer")}};

    std::vector<Item> items;
    items.reserve(navigator.Rooms().size());
    for (const auto& room : navigator.Rooms())
    {
        auto label = lila::shared::text::FromUtf8(room.name) + wxString(L" - ") +
            lila::shared::text::FromUtf8(room.gameType) +
            wxString::Format(L", %d sur %d", room.playersCount + room.botsCount, room.maxPlayers);
        if (!room.ownerUsername.empty())
            label += wxString(L", par ") + lila::shared::text::FromUtf8(room.ownerUsername);
        items.push_back({std::to_string(room.id), std::move(label)});
    }
    if (items.empty()) items.push_back({"empty", wxString(L"Aucune table disponible")});
    return items;
}
}
