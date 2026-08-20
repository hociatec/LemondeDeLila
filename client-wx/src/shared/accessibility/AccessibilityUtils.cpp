#include "shared/accessibility/AccessibilityUtils.h"

#include <wx/string.h>
#include <wx/window.h>

namespace lila::shared::accessibility
{
void AccessibilityUtils::ConfigureLinearTabOrder(std::initializer_list<wxWindow*> controls)
{
    wxWindow* previous = nullptr;
    for (wxWindow* control : controls)
    {
        if (control == nullptr)
        {
            continue;
        }

        if (previous != nullptr)
        {
            if (control->GetParent() == previous->GetParent())
            {
                control->MoveAfterInTabOrder(previous);
            }
        }

        previous = control;
    }
}

void AccessibilityUtils::SetSecondaryActionAvailability(wxWindow* control, bool available)
{
    if (control == nullptr)
    {
        return;
    }

    control->Show(available);
    control->Enable(available);
}

void AccessibilityUtils::SetAccessibleStatus(wxWindow& control, const wxString& message)
{
    if (message.empty())
    {
        SetAccessibleName(control, wxString(L"État"), wxString(L"État"));
        return;
    }

    SetAccessibleName(control, message, wxString(L"État : ") + message);
}

void AccessibilityUtils::SetAccessibleName(wxWindow& control, const wxString& name, const wxString& description)
{
    control.SetName(name);
    control.SetHelpText(description);
}
}
