#include "modules/options/presentation/OptionsView.h"

#include <wx/window.h>

#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::options::presentation
{
void OptionsView::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    auto applyWindowTheme = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(Theme::PanelBackground());
        window->SetForegroundColour(Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        applyWindowTheme(child);
    }

    if (sectionBook != nullptr)
    {
        sectionBook->SetBackgroundColour(Theme::PanelBackground());
        sectionBook->SetForegroundColour(Theme::TextPrimary());
    }

    if (statusLabel != nullptr)
    {
        statusLabel->SetForegroundColour(Theme::Accent());
    }
}
}
