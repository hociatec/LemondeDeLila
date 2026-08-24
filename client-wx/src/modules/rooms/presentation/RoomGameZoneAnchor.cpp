#include "modules/rooms/presentation/RoomGameZoneAnchor.h"

#include <utility>

#include <wx/access.h>
#include <wx/dcbuffer.h>
#include <wx/event.h>
#include <wx/weakref.h>

#include "shared/accessibility/NavigationController.h"
#include "shared/ui/Theme.h"

namespace lila::modules::rooms::presentation
{
#if wxUSE_ACCESSIBILITY
namespace
{
class GameZoneAccessible final : public wxWindowAccessible
{
public:
    explicit GameZoneAccessible(RoomGameZoneAnchor& anchor)
        : wxWindowAccessible(&anchor), anchor_(&anchor) {}

    wxAccStatus GetRole(int childId, wxAccRole* role) override
    {
        if (childId != wxACC_SELF || role == nullptr) return wxACC_INVALID_ARG;
        *role = wxROLE_SYSTEM_GROUPING;
        return wxACC_OK;
    }

    wxAccStatus GetState(int childId, long* state) override
    {
        if (childId != wxACC_SELF || state == nullptr) return wxACC_INVALID_ARG;
        auto* anchor = anchor_.get();
        *state = wxACC_STATE_SYSTEM_FOCUSABLE;
        if (anchor != nullptr && anchor->HasFocus()) *state |= wxACC_STATE_SYSTEM_FOCUSED;
        if (anchor == nullptr || !anchor->IsShownOnScreen()) *state |= wxACC_STATE_SYSTEM_INVISIBLE;
        return wxACC_OK;
    }

    wxAccStatus GetDefaultAction(int childId, wxString* actionName) override
    {
        if (childId != wxACC_SELF || actionName == nullptr) return wxACC_INVALID_ARG;
        *actionName = wxString(L"Ouvrir");
        return wxACC_OK;
    }

    wxAccStatus DoDefaultAction(int childId) override
    {
        auto* anchor = anchor_.get();
        if (childId != wxACC_SELF || anchor == nullptr) return wxACC_INVALID_ARG;
        anchor->Activate();
        return wxACC_OK;
    }

private:
    wxWeakRef<RoomGameZoneAnchor> anchor_;
};
}
#endif

RoomGameZoneAnchor::RoomGameZoneAnchor(wxWindow* parent)
    : wxControl(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxWANTS_CHARS)
{
    SetBackgroundStyle(wxBG_STYLE_PAINT);
#if wxUSE_ACCESSIBILITY
    new GameZoneAccessible(*this);
#endif
    Bind(wxEVT_CHAR_HOOK, &RoomGameZoneAnchor::OnKeyDown, this);
    Bind(wxEVT_LEFT_UP, &RoomGameZoneAnchor::OnLeftUp, this);
    Bind(wxEVT_PAINT, &RoomGameZoneAnchor::OnPaint, this);
    Bind(wxEVT_SET_FOCUS, [this](wxFocusEvent& event) { Refresh(); event.Skip(); });
    Bind(wxEVT_KILL_FOCUS, [this](wxFocusEvent& event) { Refresh(); event.Skip(); });
}

void RoomGameZoneAnchor::SetTitle(const wxString& title)
{
    if (GetLabel() == title && GetName() == title) return;
    SetLabel(title);
    SetName(title);
    Refresh();
}

void RoomGameZoneAnchor::SetActivatedHandler(ActivatedHandler handler) { onActivated_ = std::move(handler); }
void RoomGameZoneAnchor::Activate() { if (onActivated_) onActivated_(); }

wxSize RoomGameZoneAnchor::DoGetBestClientSize() const { return wxSize(360, 80); }

void RoomGameZoneAnchor::OnKeyDown(wxKeyEvent& event)
{
    const int key = event.GetKeyCode();
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER) Activate();
    else if (key == WXK_LEFT || key == WXK_RIGHT || key == WXK_UP || key == WXK_DOWN ||
        key == WXK_NUMPAD_LEFT || key == WXK_NUMPAD_RIGHT || key == WXK_NUMPAD_UP || key == WXK_NUMPAD_DOWN)
        return;
    else event.Skip();
}

void RoomGameZoneAnchor::OnLeftUp(wxMouseEvent&)
{
    lila::shared::accessibility::NavigationController::Focus(this);
    Activate();
}

void RoomGameZoneAnchor::OnPaint(wxPaintEvent&)
{
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(lila::shared::ui::Theme::PanelBackground()));
    dc.Clear();
    dc.SetFont(lila::shared::ui::Theme::BodyFont());
    dc.SetTextForeground(lila::shared::ui::Theme::TextPrimary());
    dc.DrawText(GetLabel(), 14, 28);
    if (HasFocus())
    {
        dc.SetBrush(*wxTRANSPARENT_BRUSH);
        dc.SetPen(wxPen(lila::shared::ui::Theme::Accent(), 2));
        dc.DrawRectangle(GetClientRect());
    }
}
}
