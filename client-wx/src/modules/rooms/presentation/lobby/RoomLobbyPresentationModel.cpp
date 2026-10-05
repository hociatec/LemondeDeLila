#include "modules/rooms/presentation/lobby/RoomLobbyPresentationModel.h"

#include <string_view>

#include <wx/datetime.h>

#include "modules/rooms/presentation/navigation/RoomLobbyNavigator.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
namespace
{
wxString FormatCreatedAt(std::string_view rawCreatedAt)
{
    auto raw = lila::shared::text::FromUtf8(rawCreatedAt);
    if (raw.length() < 19) return raw;

    wxDateTime createdAt;
    if (!createdAt.ParseISOCombined(raw.Left(19))) return raw;
    if (raw.length() > 19 && raw.Last() == 'Z') createdAt.MakeFromUTC();
    return createdAt.Format(wxString(L"%d.%m.%Y %H:%M"));
}
}

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
        wxString label;
        if (!room.gameName.empty())
        {
            label = lila::shared::text::FromUtf8(room.gameName);
            if (!room.playersLabel.empty())
                label += wxString(L" avec ") + lila::shared::text::FromUtf8(room.playersLabel);
            const auto createdAt = FormatCreatedAt(room.createdAt);
            if (!createdAt.empty()) label += wxString(L", ") + createdAt;
        }
        else
        {
            label = lila::shared::text::FromUtf8(room.name) + wxString(L" - ") +
                lila::shared::text::FromUtf8(room.gameType) +
                wxString::Format(L", %d sur %d", room.playersCount + room.botsCount, room.maxPlayers);
            if (!room.ownerUsername.empty())
                label += wxString(L", par ") + lila::shared::text::FromUtf8(room.ownerUsername);
        }
        items.push_back({std::to_string(room.id), std::move(label)});
    }
    if (items.empty())
        items.push_back({"empty", wxString(L"Aucune partie n\u2019est en cours")});
    return items;
}
}
