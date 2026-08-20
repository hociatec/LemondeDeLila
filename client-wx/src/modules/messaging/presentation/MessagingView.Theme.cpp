#include "modules/messaging/presentation/MessagingView.h"

#include <wx/window.h>

#include "shared/ui/Theme.h"

namespace lila::modules::messaging::presentation
{
void MessagingView::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    const auto styleWindow = [](wxWindow* window)
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
        styleWindow(child);
    }

    styleWindow(menuPanel);
    styleWindow(listPanel);
    styleWindow(detailPanel);
    styleWindow(composePanel);

    messagesList->SetBackgroundColour(wxColour(12, 21, 35));
    messagesList->SetForegroundColour(Theme::TextPrimary());
    emptyMessagesCtrl->SetBackgroundColour(wxColour(12, 21, 35));
    emptyMessagesCtrl->SetForegroundColour(Theme::TextPrimary());
    detailCtrl->SetBackgroundColour(wxColour(12, 21, 35));
    detailCtrl->SetForegroundColour(Theme::TextPrimary());
    recipientCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    recipientCtrl->SetForegroundColour(Theme::TextPrimary());
    subjectCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    subjectCtrl->SetForegroundColour(Theme::TextPrimary());
    bodyCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    bodyCtrl->SetForegroundColour(Theme::TextPrimary());
    statusLabel->SetForegroundColour(Theme::Accent());
}
}
