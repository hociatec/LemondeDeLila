#include "modules/storybook/presentation/StoryBookPanel.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    SetMinSize(wxSize(960, 700));

    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    root->SetBackgroundColour(lila::shared::ui::Theme::Background());
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    titleLabel_ = new wxStaticText(root, wxID_ANY, wxString(L"Livre des contes"));
    titleLabel_->Hide();
    menu_ = new lila::shared::ui::controls::VerticalMenu(
        root,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>{},
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    menu_->SetTabNavigationEnabled(false);
    menu_->SetMinSize(wxSize(420, -1));
    statusLabel_ = new wxStaticText(root, wxID_ANY, wxString{});
    statusLabel_->Hide();

    rootSizer->Add(titleLabel_, 0);
    rootSizer->Add(menu_, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    root->SetSizer(rootSizer);

    auto* panelSizer = new wxBoxSizer(wxVERTICAL);
    panelSizer->Add(root, 1, wxEXPAND);
    SetSizer(panelSizer);
    menu_->ApplyTheme();
}
}
