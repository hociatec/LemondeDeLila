#include "shared/ui/presentation/layout/ListPageLayout.h"

#include <span>

#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::shared::ui::layout
{
ListPageLayoutControls BuildListPageLayout(
    wxPanel& owner,
    const ListPageLayoutOptions& options)
{
    owner.SetBackgroundColour(lila::shared::ui::Theme::Background());
    owner.SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    if (options.minimumSize != wxDefaultSize) owner.SetMinSize(options.minimumSize);

    wxPanel* content = &owner;
    if (options.wrapInNonFocusablePanel)
    {
        content = new lila::shared::accessibility::NonFocusablePanel(&owner);
        content->SetBackgroundColour(lila::shared::ui::Theme::Background());
    }

    auto* contentSizer = new wxBoxSizer(wxVERTICAL);
    ListPageLayoutControls controls;
    if (!options.title.empty())
    {
        controls.title = new wxStaticText(content, wxID_ANY, options.title);
        controls.title->Hide();
        contentSizer->Add(controls.title, 0);
    }

    controls.menu = new lila::shared::ui::controls::VerticalMenu(
        content,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>{},
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    controls.menu->SetMinSize(wxSize(options.menuWidth, -1));
    controls.status = new wxStaticText(content, wxID_ANY, wxString{});
    controls.status->Hide();

    contentSizer->Add(controls.menu, 1, wxEXPAND | wxALL, 24);
    contentSizer->Add(controls.status, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    content->SetSizer(contentSizer);

    if (content != &owner)
    {
        auto* ownerSizer = new wxBoxSizer(wxVERTICAL);
        ownerSizer->Add(content, 1, wxEXPAND);
        owner.SetSizer(ownerSizer);
    }

    controls.menu->ApplyTheme();
    return controls;
}
}
