#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include <algorithm>
#include <span>
#include <string>

#include <wx/stattext.h>

#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::leaderboard::presentation
{
void LeaderboardPanel::ShowCurrentPage()
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    std::vector<Item> items;
    wxString title(L"Classement");

    if (navigator_.CurrentPage() == LeaderboardNavigator::Page::Games)
    {
        if (navigator_.Games().empty())
        {
            items.push_back({"empty", wxString(L"Aucune information encore disponible")});
        }
        else
        {
            for (const auto& game : navigator_.Games())
            {
                items.push_back({game.gameType, lila::shared::text::FromUtf8(game.gameName)});
            }
        }
    }
    else
    {
        if (const auto* game = navigator_.CurrentGame())
        {
            title += wxString(L" - ") + lila::shared::text::FromUtf8(game->gameName);
        }
        const auto entryCount = std::min<std::size_t>(navigator_.Entries().size(), 10);
        for (std::size_t index = 0; index < entryCount; ++index)
        {
            const auto& entry = navigator_.Entries()[index];
            auto label = wxString::Format(L"%zu. ", index + 1) +
                lila::shared::text::FromUtf8(entry.username) +
                wxString::Format(
                    wxString(L" - %d victoire(s), %d d\u00E9faite(s)"),
                    entry.wins,
                    entry.losses);
            items.push_back({std::to_string(entry.userId), std::move(label)});
        }
        if (items.empty())
        {
            items.push_back({"empty", wxString(L"Aucune information encore disponible")});
        }
    }

    titleLabel_->SetLabel(title);
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(navigator_.SelectedIndex());
    UpdateStatus(wxString{});
    FocusMenuIfVisible();
}

void LeaderboardPanel::ShowError(const wxString& message, Request request, std::size_t gameIndex)
{
    state_ = State::Error;
    pendingRequest_ = request;
    pendingGameIndex_ = gameIndex;
    const lila::shared::ui::controls::VerticalMenuItem retry{"retry", wxString(L"R\u00E9essayer")};
    menu_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(&retry, 1));
    menu_->SetSelectedIndexSilently(0);
    UpdateStatus(message, true);
    FocusMenuIfVisible();
}

void LeaderboardPanel::FocusMenuIfVisible()
{
    if (IsShownOnScreen())
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
    }
}

void LeaderboardPanel::UpdateStatus(const wxString& message, bool isError)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    statusLabel_->Show(!message.empty());
    if (isError && !message.empty())
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*statusLabel_, message);
    else
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}
}
