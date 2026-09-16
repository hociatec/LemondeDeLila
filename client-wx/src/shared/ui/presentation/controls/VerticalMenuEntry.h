#pragma once

#include <wx/control.h>
#include <optional>

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
    void SetLiveLabel(const wxString& label) { liveLabel_ = label; Refresh(); }
    void ClearLiveLabel() { liveLabel_.reset(); }
    [[nodiscard]] wxString PresentedLabel() const { return liveLabel_.value_or(GetLabel()); }
    [[nodiscard]] wxString AccessibleLabel() const { return liveLabel_.value_or(GetName()); }

protected:
    [[nodiscard]] wxSize DoGetBestClientSize() const override;

private:
    std::optional<wxString> liveLabel_;
    void OnFocusChanged(wxFocusEvent& event);
    void OnLeftUp(wxMouseEvent& event);
    void OnPaint(wxPaintEvent& event);
};
}
