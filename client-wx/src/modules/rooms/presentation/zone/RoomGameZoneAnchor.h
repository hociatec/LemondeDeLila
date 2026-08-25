#pragma once

#include <functional>

#include <wx/control.h>

namespace lila::modules::rooms::presentation
{
class RoomGameZoneAnchor final : public wxControl
{
public:
    using ActivatedHandler = std::function<void()>;
    using KeyHandler = std::function<bool(wxKeyEvent&)>;

    explicit RoomGameZoneAnchor(wxWindow* parent);
    void SetTitle(const wxString& title);
    void SetActivatedHandler(ActivatedHandler handler);
    void SetKeyHandler(KeyHandler handler);
    void Activate();

protected:
    [[nodiscard]] wxSize DoGetBestClientSize() const override;

private:
    void OnKeyDown(wxKeyEvent& event);
    void OnLeftUp(wxMouseEvent& event);
    void OnPaint(wxPaintEvent& event);

    ActivatedHandler onActivated_;
    KeyHandler onKey_;
};
}
