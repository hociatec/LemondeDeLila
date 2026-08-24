#pragma once

#include <wx/control.h>

class wxFocusEvent;
class wxMouseEvent;
class wxPaintEvent;

namespace lila::shared::ui::controls
{
class VerticalMenuEntry final : public wxControl
{
public:
    VerticalMenuEntry(wxWindow* parent, const wxString& label);

    void Activate();
    void ApplyTheme();

protected:
    [[nodiscard]] wxSize DoGetBestClientSize() const override;

private:
    void OnFocusChanged(wxFocusEvent& event);
    void OnLeftUp(wxMouseEvent& event);
    void OnPaint(wxPaintEvent& event);
};
}
