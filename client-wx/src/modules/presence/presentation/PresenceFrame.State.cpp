#include "modules/presence/presentation/PresenceFrame.h"
#include <algorithm>

#include <wx/stattext.h>

#include "modules/presence/application/PresenceMonitor.h"
#include "modules/presence/presentation/PresencePresentationModel.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::presence::presentation
{
namespace
{
using MenuItem = lila::shared::ui::controls::VerticalMenuItem;

wxString FromUtf8(const std::string& value)
{
    return lila::shared::text::FromUtf8(value);
}
}

void PresenceFrame::RefreshPlayers()
{
    if (page_ != Page::Players)
    {
        return;
    }
    RebuildPlayers();
}

void PresenceFrame::RebuildPlayers(std::optional<int> preferredPlayerId, bool focusSelection)
{
    std::optional<int> previous = preferredPlayerId;
    if (!previous.has_value())
    {
        const auto selected = SelectedPlayer();
        if (selected.has_value())
        {
            previous = selected->id;
        }
    }
    players_ = presenceMonitor_.Players();
    const bool hasSnapshot = presenceMonitor_.HasSnapshot();
    auto items = hasSnapshot
        ? PresencePresentationModel::BuildPlayerItems(players_)
        : std::vector<MenuItem>{};
    std::size_t selectedIndex = items.empty() ? 0 : std::min(menu_->GetSelectedIndex(), items.size() - 1);
    for (std::size_t index = 0; index < players_.size(); ++index)
    {
        const auto& player = players_[index];
        if (previous.has_value() && player.id == *previous)
        {
            selectedIndex = index;
        }
    }
    // Keep the focused native control attached to the same player on live updates.
    menu_->SetItemsForNavigation(items, selectedIndex, true);

    titleLabel_->SetLabel(hasSnapshot
        ? PresencePresentationModel::BuildTitle(players_.size())
        : wxString(L"Présence"));
    detailsLabel_->SetLabel(hasSnapshot
        ? FromUtf8(presenceMonitor_.Status())
        : wxString(L"Chargement de la présence..."));
    UpdateStatus(wxString(L"Flèches : naviguer. Entrée : sélectionner. Échap : fermer."));
    if (focusSelection)
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
    }
}

void PresenceFrame::RebuildActions()
{
    if (!selectedPlayer_.has_value())
    {
        page_ = Page::Players;
        RebuildPlayers();
        return;
    }

    if (!socialState_.has_value())
    {
        ShowLoadingActions();
        return;
    }

    auto items = PresencePresentationModel::BuildActionItems(*socialState_);
    const auto roomId = selectedPlayer_->currentRoomId;
    bool sameRoom = false;
    for (const auto& player : presenceMonitor_.Players())
        if (IsSelf(player) && player.currentRoomId == roomId) sameRoom = true;
    if (roomId.has_value() && *roomId > 0 && !sameRoom && onJoinRoomRequested_)
        items.insert(items.begin(), {"join", wxString(L"Rejoindre sa table")});
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(0);
    detailsLabel_->SetLabel(wxEmptyString);
    UpdateStatus(wxString(L"Flèches : naviguer. Entrée : sélectionner. Échap : retour."));
    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
}

void PresenceFrame::ShowLoadingActions()
{
    busy_ = true;
    detailsLabel_->SetLabel(wxEmptyString);
    UpdateStatus(wxString(L"Chargement des actions."));
}

void PresenceFrame::UpdateStatus(const wxString& message, bool isError)
{
    if (statusLabel_->GetLabel() != message) statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? wxColour(240, 130, 130) : lila::shared::ui::Theme::Accent());
    Layout();
}
}
