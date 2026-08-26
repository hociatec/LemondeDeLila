#pragma once

#include <wx/gdicmn.h>
#include <wx/string.h>

class wxPanel;
class wxStaticText;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::shared::ui::layout
{
struct ListPageLayoutOptions final
{
    wxString title;
    int menuWidth = 420;
    wxSize minimumSize = wxDefaultSize;
    bool wrapInNonFocusablePanel = false;
};

struct ListPageLayoutControls final
{
    lila::shared::ui::controls::VerticalMenu* menu = nullptr;
    wxStaticText* title = nullptr;
    wxStaticText* status = nullptr;
};

[[nodiscard]] ListPageLayoutControls BuildListPageLayout(
    wxPanel& owner,
    const ListPageLayoutOptions& options);
}
