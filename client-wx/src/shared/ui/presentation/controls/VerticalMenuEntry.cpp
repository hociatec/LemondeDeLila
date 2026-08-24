#include "shared/ui/presentation/controls/VerticalMenuEntry.h"

#include <wx/access.h>
#include <wx/dcbuffer.h>
#include <wx/dcclient.h>
#include <wx/event.h>
#include <wx/weakref.h>

#include "shared/ui/presentation/theme/Theme.h"

namespace lila::shared::ui::controls
{
namespace
{
constexpr int HorizontalPadding = 14;
constexpr int EntryHeight = 42;

#if wxUSE_ACCESSIBILITY
class VerticalMenuEntryAccessible final : public wxWindowAccessible
{
public:
    explicit VerticalMenuEntryAccessible(VerticalMenuEntry& entry)
        : wxWindowAccessible(&entry), entry_(&entry)
    {
    }

    wxAccStatus GetRole(int childId, wxAccRole* role) override
    {
        if (childId != wxACC_SELF || role == nullptr)
        {
            return wxACC_INVALID_ARG;
        }
        *role = wxROLE_SYSTEM_MENUITEM;
        return wxACC_OK;
    }

    wxAccStatus GetName(int childId, wxString* name) override
    {
        auto* entry = entry_.get();
        if (childId != wxACC_SELF || name == nullptr || entry == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        *name = entry->GetName();
        if (name->empty())
        {
            *name = entry->GetLabel();
        }
        return name->empty() ? wxACC_NOT_SUPPORTED : wxACC_OK;
    }

    wxAccStatus GetState(int childId, long* state) override
    {
        if (childId != wxACC_SELF || state == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        auto* entry = entry_.get();
        *state = wxACC_STATE_SYSTEM_FOCUSABLE | wxACC_STATE_SYSTEM_SELECTABLE;
        if (entry == nullptr || !entry->IsShownOnScreen())
        {
            *state |= wxACC_STATE_SYSTEM_INVISIBLE;
        }
        if (entry != nullptr && !entry->IsEnabled())
        {
            *state |= wxACC_STATE_SYSTEM_UNAVAILABLE;
        }
        if (entry != nullptr && entry->HasFocus())
        {
            *state |= wxACC_STATE_SYSTEM_FOCUSED | wxACC_STATE_SYSTEM_SELECTED;
        }
        return wxACC_OK;
    }

    wxAccStatus GetDefaultAction(int childId, wxString* actionName) override
    {
        if (childId != wxACC_SELF || actionName == nullptr)
        {
            return wxACC_INVALID_ARG;
        }
        *actionName = wxString(L"Ouvrir");
        return wxACC_OK;
    }

    wxAccStatus DoDefaultAction(int childId) override
    {
        auto* entry = entry_.get();
        if (childId != wxACC_SELF || entry == nullptr)
        {
            return wxACC_INVALID_ARG;
        }
        entry->Activate();
        return wxACC_OK;
    }

    wxAccStatus Select(int childId, wxAccSelectionFlags selectFlags) override
    {
        auto* entry = entry_.get();
        if (childId != wxACC_SELF || entry == nullptr)
        {
            return wxACC_INVALID_ARG;
        }
        if ((selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
        {
            entry->SetFocus();
        }
        return wxACC_OK;
    }

private:
    wxWeakRef<VerticalMenuEntry> entry_;
};
#endif
}

VerticalMenuEntry::VerticalMenuEntry(wxWindow* parent, const wxString& label)
    : wxControl(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxWANTS_CHARS)
{
    SetLabel(label);
    SetName(label);
    SetBackgroundStyle(wxBG_STYLE_PAINT);
#if wxUSE_ACCESSIBILITY
    new VerticalMenuEntryAccessible(*this);
#endif
    Bind(wxEVT_PAINT, &VerticalMenuEntry::OnPaint, this);
    Bind(wxEVT_LEFT_UP, &VerticalMenuEntry::OnLeftUp, this);
    Bind(wxEVT_SET_FOCUS, &VerticalMenuEntry::OnFocusChanged, this);
    Bind(wxEVT_KILL_FOCUS, &VerticalMenuEntry::OnFocusChanged, this);
    ApplyTheme();
}

void VerticalMenuEntry::Activate()
{
    wxCommandEvent event(wxEVT_BUTTON, GetId());
    event.SetEventObject(this);
    ProcessWindowEvent(event);
}

void VerticalMenuEntry::ApplyTheme()
{
    SetFont(lila::shared::ui::Theme::BodyFont());
    SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    Refresh();
}

wxSize VerticalMenuEntry::DoGetBestClientSize() const
{
    wxClientDC dc(const_cast<VerticalMenuEntry*>(this));
    dc.SetFont(GetFont());
    const wxSize textSize = dc.GetTextExtent(GetLabel());
    return wxSize(textSize.GetWidth() + 2 * HorizontalPadding, EntryHeight);
}

void VerticalMenuEntry::OnFocusChanged(wxFocusEvent& event)
{
    Refresh();
    event.Skip();
}

void VerticalMenuEntry::OnLeftUp(wxMouseEvent& event)
{
    SetFocus();
    Activate();
    event.Skip(false);
}

void VerticalMenuEntry::OnPaint(wxPaintEvent& event)
{
    (void)event;
    wxAutoBufferedPaintDC dc(this);
    const wxRect bounds = GetClientRect();
    const bool focused = HasFocus();

    dc.SetBackground(wxBrush(focused ? lila::shared::ui::Theme::AccentMuted() : GetBackgroundColour()));
    dc.Clear();
    dc.SetFont(GetFont());
    dc.SetTextForeground(GetForegroundColour());
    const wxSize textSize = dc.GetTextExtent(GetLabel());
    dc.DrawText(GetLabel(), HorizontalPadding, (bounds.GetHeight() - textSize.GetHeight()) / 2);

    if (focused)
    {
        dc.SetBrush(*wxTRANSPARENT_BRUSH);
        dc.SetPen(wxPen(lila::shared::ui::Theme::Accent(), 2));
        dc.DrawRectangle(bounds);
    }
}
}
