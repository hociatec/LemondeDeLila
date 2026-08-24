#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <wx/stattext.h>

#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::main_menu::presentation
{
void MainMenuFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());

    titleLabel_->SetFont(Theme::TitleFont());
    titleLabel_->SetForegroundColour(Theme::TextPrimary());

    welcomeLabel_->SetFont(Theme::BodyFont());
    welcomeLabel_->SetForegroundColour(Theme::TextMuted());

    navigationLabel_->SetFont(Theme::BodyFont());
    navigationLabel_->SetForegroundColour(Theme::TextPrimary());

    if (menu_ != nullptr)
    {
        menu_->ApplyTheme();
    }

    statusLabel_->SetFont(Theme::BodyFont());
    statusLabel_->SetForegroundColour(Theme::Accent());

    versionLabel_->SetFont(Theme::BodyFont());
    versionLabel_->SetForegroundColour(Theme::TextMuted());
}
}
