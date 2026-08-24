#include "modules/catalog/presentation/CatalogPanel.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::catalog::presentation
{
void CatalogPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    SetMinSize(wxSize(960, 700));

    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    root->SetBackgroundColour(lila::shared::ui::Theme::Background());
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* title = new wxStaticText(root, wxID_ANY, wxString(L"Taverne"));
    title->Hide();

    shelvesMenu_ = new lila::shared::ui::controls::VerticalMenu(
        root,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>{},
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    shelvesMenu_->SetTabNavigationEnabled(false);
    shelvesMenu_->SetMinSize(wxSize(360, -1));

    statusLabel_ = new wxStaticText(root, wxID_ANY, wxString{});
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Accent());
    statusLabel_->Hide();

    rootSizer->Add(title, 0);
    rootSizer->Add(shelvesMenu_, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);
    shelvesMenu_->ApplyTheme();
}
}
