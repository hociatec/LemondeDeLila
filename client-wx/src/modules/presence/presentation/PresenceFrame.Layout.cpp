#include "modules/presence/presentation/PresenceFrame.h"

#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::presence::presentation
{
void PresenceFrame::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    auto* root = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(this, wxID_ANY, wxString(L"Presence"));
    titleLabel_->Hide();
    menu_ = new lila::shared::ui::controls::VerticalMenu(
        this,
        {},
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    detailsLabel_ = new wxStaticText(this, wxID_ANY, wxEmptyString);
    statusLabel_ = new wxStaticText(this, wxID_ANY, wxEmptyString);
    detailsLabel_->SetMinSize(wxSize(-1, 70));
    statusLabel_->SetMinSize(wxSize(-1, 36));

    root->Add(titleLabel_, 0, wxALL, 0);
    root->Add(menu_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 20);
    root->Add(detailsLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 20);
    root->Add(statusLabel_, 0, wxEXPAND | wxALL, 20);
    SetSizer(root);

    menu_->ApplyTheme();
    detailsLabel_->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    detailsLabel_->SetForegroundColour(lila::shared::ui::Theme::TextMuted());
    statusLabel_->SetBackgroundColour(lila::shared::ui::Theme::Background());
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu_, wxString(L"Presence"));
}
}
