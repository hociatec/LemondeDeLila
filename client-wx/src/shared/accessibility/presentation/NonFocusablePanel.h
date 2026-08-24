#pragma once

#include <wx/panel.h>

namespace lila::shared::accessibility
{
class NonFocusablePanel : public wxPanel
{
public:
    NonFocusablePanel(wxWindow* parent, long style = wxTAB_TRAVERSAL)
        : wxPanel(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, style)
    {
    }

    [[nodiscard]] bool AcceptsFocus() const override
    {
        return false;
    }

    [[nodiscard]] bool AcceptsFocusFromKeyboard() const override
    {
        return false;
    }
};
}
