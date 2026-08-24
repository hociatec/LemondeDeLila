#include "modules/presence/presentation/PresenceFrame.h"

#include <wx/stattext.h>

#include "modules/presence/presentation/PresencePresentationModel.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::presence::presentation
{
void PresenceFrame::BindEvents()
{
    menu_->SetActivatedHandler([this](std::size_t) { ActivateSelected(); });
    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            HandleEscape();
            return true;
        });
}

void PresenceFrame::ActivateSelected()
{
    if (busy_)
    {
        return;
    }
    if (page_ == Page::Players)
    {
        ActivatePlayer();
        return;
    }
    RunSelectedAction();
}

void PresenceFrame::ActivatePlayer()
{
    auto player = SelectedPlayer();
    if (!player.has_value())
    {
        return;
    }
    if (IsSelf(*player))
    {
        detailsLabel_->SetLabel(wxString(L"Ceci est votre propre profil de presence."));
        return;
    }
    selectedPlayer_ = *player;
    socialState_.reset();
    page_ = Page::Actions;
    titleLabel_->SetLabel(PresencePresentationModel::BuildPlayerLabel(*player));
    ShowLoadingActions();
    LoadSocialState(player->id);
}

void PresenceFrame::HandleEscape()
{
    if (page_ == Page::Actions)
    {
        std::optional<int> previousId;
        if (selectedPlayer_.has_value())
        {
            previousId = selectedPlayer_->id;
        }
        page_ = Page::Players;
        selectedPlayer_.reset();
        socialState_.reset();
        RebuildPlayers(previousId, true);
        return;
    }
    if (onCloseRequested_)
    {
        onCloseRequested_();
    }
}

std::optional<domain::PresencePlayer> PresenceFrame::SelectedPlayer() const
{
    if (players_.empty() || menu_ == nullptr || menu_->GetSelectedIndex() >= players_.size())
    {
        return std::nullopt;
    }
    return players_[menu_->GetSelectedIndex()];
}

bool PresenceFrame::IsSelf(const domain::PresencePlayer& player) const
{
    if (!sessionStore_.HasActiveSession())
    {
        return false;
    }
    return PresencePresentationModel::IsSelf(player, sessionStore_.Current());
}

std::string PresenceFrame::SelectedActionId() const
{
    if (menu_ == nullptr)
    {
        return {};
    }
    const auto id = menu_->GetSelectedItemId();
    return id.has_value() ? std::string(*id) : std::string();
}
}
