#include "modules/rooms/presentation/JoinRoomsPanel.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    menu_ = new lila::shared::ui::controls::VerticalMenu(
        this,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>{},
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    menu_->SetTabNavigationEnabled(false);
    menu_->SetMinSize(wxSize(520, -1));
    statusLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    statusLabel_->Hide();
    rootSizer->Add(menu_, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    SetSizer(rootSizer);
    menu_->ApplyTheme();
}
}
