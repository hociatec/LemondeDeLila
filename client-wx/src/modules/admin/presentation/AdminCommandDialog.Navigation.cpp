#include "modules/admin/presentation/AdminCommandDialog.h"

#include <algorithm>
#include <vector>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/textctrl.h>
#include <wx/window.h>

namespace lila::modules::admin::presentation
{
bool AdminCommandDialog::MoveFocusByArrow(bool forward)
{
    std::vector<wxWindow*> controls;
    controls.reserve(fields_.size() * 2 + 2);
    for (const auto& field : fields_)
    {
        if (field.include != nullptr && field.include->IsShown() && field.include->IsEnabled())
            controls.push_back(field.include);
        if (field.editor != nullptr && field.editor->IsShown() && field.editor->IsEnabled())
            controls.push_back(field.editor);
    }
    for (const int id : {wxID_OK, wxID_CANCEL})
        if (auto* button = FindWindow(id); button != nullptr && button->IsShown() && button->IsEnabled())
            controls.push_back(button);
    if (controls.empty()) return true;

    auto* focused = wxWindow::FindFocus();
    if (const auto* text = dynamic_cast<wxTextCtrl*>(focused); text != nullptr && text->IsMultiLine())
    {
        long column = 0;
        long line = 0;
        text->PositionToXY(text->GetInsertionPoint(), &column, &line);
        if ((!forward && line > 0) || (forward && line + 1 < text->GetNumberOfLines())) return false;
    }
    if (const auto* choice = dynamic_cast<wxChoice*>(focused); choice != nullptr)
    {
        const auto selection = choice->GetSelection();
        if ((!forward && selection > 0) ||
            (forward && selection != wxNOT_FOUND &&
             selection + 1 < static_cast<int>(choice->GetCount()))) return false;
    }
    const auto current = std::find_if(controls.begin(), controls.end(), [focused](wxWindow* control)
    {
        return focused == control || control->IsDescendant(focused);
    });
    if (current == controls.end())
    {
        controls[forward ? 0 : controls.size() - 1]->SetFocus();
        return true;
    }
    const auto index = static_cast<std::size_t>(std::distance(controls.begin(), current));
    if (forward && index + 1 < controls.size()) controls[index + 1]->SetFocus();
    if (!forward && index > 0) controls[index - 1]->SetFocus();
    return true;
}
}
