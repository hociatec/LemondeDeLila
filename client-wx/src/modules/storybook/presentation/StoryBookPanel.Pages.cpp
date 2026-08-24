#include "modules/storybook/presentation/StoryBookPanel.h"

#include <string>

#include <wx/stattext.h>

#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::ShowCurrentPage()
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    std::vector<Item> items;
    wxString title;

    switch (navigator_.CurrentPage())
    {
    case StoryBookNavigator::Page::Root:
        title = wxString(L"Livre des contes");
        items.push_back({"consult", wxString(L"Consulter mon livre des contes")});
        items.push_back({"leaderboard", wxString(L"Classement")});
        break;
    case StoryBookNavigator::Page::Games:
        title = targetUserId_.has_value()
            ? wxString(L"Livre des contes de ") + lila::shared::text::FromUtf8(targetUsername_)
            : wxString(L"Mon livre des contes");
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
        break;
    case StoryBookNavigator::Page::Modes:
        if (const auto* game = navigator_.CurrentGame())
        {
            title = lila::shared::text::FromUtf8(game->gameName);
        }
        items.push_back({"with-bots", wxString(L"Avec bots")});
        items.push_back({"without-bots", wxString(L"Sans bots")});
        break;
    case StoryBookNavigator::Page::Details:
        if (const auto* game = navigator_.CurrentGame())
        {
            title = lila::shared::text::FromUtf8(game->gameName) +
                (navigator_.CurrentModeUsesBots() ? wxString(L" - Avec bots") : wxString(L" - Sans bots"));
        }
        if (const auto* counts = navigator_.CurrentCounts())
        {
            items.push_back({"finished", wxString::Format(wxString(L"Parties termin\u00E9es : %d"), counts->finished)});
            items.push_back({"quit", wxString::Format(wxString(L"Parties quitt\u00E9es : %d"), counts->quit)});
            items.push_back({"won", wxString::Format(wxString(L"Gagn\u00E9es : %d"), counts->won)});
            items.push_back({"lost", wxString::Format(wxString(L"Perdues : %d"), counts->lost)});
        }
        break;
    }

    titleLabel_->SetLabel(title);
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(navigator_.SelectedIndex());
    UpdateStatus(wxString{});
    FocusMenuIfVisible();
}

void StoryBookPanel::FocusMenuIfVisible()
{
    if (IsShownOnScreen())
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
    }
}

void StoryBookPanel::UpdateStatus(const wxString& message, bool isError)
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
