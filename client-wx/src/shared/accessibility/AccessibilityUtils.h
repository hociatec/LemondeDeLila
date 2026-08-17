#pragma once

#include <initializer_list>
#include <wx/string.h>

class wxWindow;
class wxString;

namespace lila::shared::accessibility
{
class AccessibilityUtils final
{
public:
    static void ConfigureLinearTabOrder(std::initializer_list<wxWindow*> controls);
    static void SetAccessibleStatus(wxWindow& control, const wxString& message);
    static void SetAccessibleName(wxWindow& control, const wxString& name, const wxString& description = wxString());
};
}
