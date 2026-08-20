#include "modules/social/presentation/SocialView.h"

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialView::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    const auto applyWindowTheme = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        window->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        applyWindowTheme(child);
    }

    applyWindowTheme(friendsPanel);
    applyWindowTheme(incomingRequestsPanel);
    applyWindowTheme(outgoingRequestsPanel);
    applyWindowTheme(blockedPanel);
    applyWindowTheme(profilePanel);
    applyWindowTheme(profileEditorMenuPanel);
    applyWindowTheme(profileBioEditorPanel);
    applyWindowTheme(profileVictoryEditorPanel);
    applyWindowTheme(profileDefeatEditorPanel);
    applyWindowTheme(profileVisibilityEditorPanel);

    const auto styleList = [](lila::shared::ui::controls::VerticalMenu* menu)
    {
        if (menu == nullptr || menu->GetFirstButton() == nullptr)
        {
            return;
        }

        auto* listControl = menu->GetFirstButton();
        if (listControl != nullptr)
        {
            listControl->SetBackgroundColour(wxColour(14, 32, 52));
            listControl->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
        }
    };

    styleList(friendsList);
    styleList(incomingRequestsList);
    styleList(outgoingRequestsList);
    styleList(blockedUsersList);
    const auto styleText = [](wxTextCtrl* ctrl, bool readOnly)
    {
        if (ctrl == nullptr)
        {
            return;
        }

        ctrl->SetBackgroundColour(readOnly ? wxColour(14, 32, 52) : wxColour(10, 24, 39));
        ctrl->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    styleText(profileInfoCtrl, true);
    styleText(profileBioCtrl, false);
    styleText(profileVictoryCtrl, false);
    styleText(profileDefeatCtrl, false);
    styleText(emptyFriendsCtrl, true);
    styleText(emptyIncomingRequestsCtrl, true);
    styleText(emptyOutgoingRequestsCtrl, true);
    styleText(emptyBlockedUsersCtrl, true);

    if (profileVisibilityChoice != nullptr)
    {
        profileVisibilityChoice->SetBackgroundColour(wxColour(10, 24, 39));
        profileVisibilityChoice->SetForegroundColour(Theme::TextPrimary());
    }

    const auto stylePrimaryButton = [](wxButton* button)
    {
        if (button == nullptr)
        {
            return;
        }

        button->SetBackgroundColour(lila::shared::ui::Theme::AccentMuted());
        button->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    const auto styleSecondaryButton = [](wxButton* button)
    {
        if (button == nullptr)
        {
            return;
        }

        button->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        button->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    stylePrimaryButton(profileSaveButton);
    styleSecondaryButton(profileCancelButton);
    statusLabel->SetForegroundColour(Theme::Accent());
}
}
