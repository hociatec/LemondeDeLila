#pragma once

#include "shared/accessibility/presentation/AccessibleMenu.h"

#ifdef __WXMSW__
#include <windows.h>
#endif

#if wxUSE_ACCESSIBILITY
namespace lila::shared::accessibility
{
// A row is a full MSAA object, shared by accChild and accFocus. Its presentation
// slot stays stable as labels change, just like the underlying native list row.
class AccessibleListItem final : public wxAccessible
{
public:
    AccessibleListItem(AccessibleListBox& parent, wxListBox& list, int row)
        : wxAccessible(&list), parent_(parent), list_(&list), row_(row) {}

    wxAccStatus GetParent(wxAccessible** parent) override
    {
        if (!parent) return wxACC_INVALID_ARG;
        *parent = &parent_;
        return wxACC_OK;
    }
    wxAccStatus GetChildCount(int* count) override
    {
        if (!count) return wxACC_INVALID_ARG;
        *count = 0;
        return wxACC_OK;
    }
    wxAccStatus GetName(int id, wxString* value) override
    { return id == wxACC_SELF ? parent_.GetName(row_, value) : wxACC_INVALID_ARG; }
    wxAccStatus GetValue(int id, wxString* value) override
    { return id == wxACC_SELF ? parent_.GetValue(row_, value) : wxACC_INVALID_ARG; }
    wxAccStatus GetDescription(int id, wxString* value) override
    { return GetValue(id, value); }
    wxAccStatus GetHelpText(int id, wxString* value) override
    { return GetValue(id, value); }
    wxAccStatus GetKeyboardShortcut(int id, wxString* value) override
    { return GetValue(id, value); }
    wxAccStatus GetChild(int, wxAccessible** child) override
    {
        if (child) *child = nullptr;
        return wxACC_INVALID_ARG;
    }
    wxAccStatus GetRole(int id, wxAccRole* role) override
    { return id == wxACC_SELF ? parent_.GetRole(row_, role) : wxACC_INVALID_ARG; }
    wxAccStatus GetState(int id, long* state) override
    { return id == wxACC_SELF ? parent_.GetState(row_, state) : wxACC_INVALID_ARG; }
    wxAccStatus GetDefaultAction(int id, wxString* value) override
    { return id == wxACC_SELF ? parent_.GetDefaultAction(row_, value) : wxACC_INVALID_ARG; }
    wxAccStatus DoDefaultAction(int id) override
    { return id == wxACC_SELF ? parent_.DoDefaultAction(row_) : wxACC_INVALID_ARG; }
    wxAccStatus Select(int id, wxAccSelectionFlags flags) override
    { return id == wxACC_SELF ? parent_.Select(row_, flags) : wxACC_INVALID_ARG; }

    wxAccStatus GetFocus(int* id, wxAccessible** child) override
    {
        if (!id || !child) return wxACC_INVALID_ARG;
        *id = wxACC_SELF;
        *child = nullptr;
        long state = 0;
        const auto result = GetState(wxACC_SELF, &state);
        if (result == wxACC_OK && (state & wxACC_STATE_SYSTEM_FOCUSED)) *child = this;
        return result;
    }

    wxAccStatus GetLocation(wxRect& rect, int id) override
    {
        if (id != wxACC_SELF || !list_ || row_ > static_cast<int>(list_->GetCount()))
            return wxACC_INVALID_ARG;
#ifdef __WXMSW__
        RECT bounds{};
        if (SendMessage(reinterpret_cast<HWND>(list_->GetHandle()), LB_GETITEMRECT,
                row_ - 1, reinterpret_cast<LPARAM>(&bounds)) == LB_ERR)
            return wxACC_FAIL;
        rect = wxRect(list_->ClientToScreen(wxPoint(bounds.left, bounds.top)),
            wxSize(bounds.right - bounds.left, bounds.bottom - bounds.top));
        return wxACC_OK;
#else
        return wxACC_NOT_IMPLEMENTED;
#endif
    }

    wxAccStatus Navigate(wxNavDir direction, int from, int* to, wxAccessible** object) override
    {
        if (from != wxACC_SELF || !to || !object) return wxACC_INVALID_ARG;
        *to = wxACC_SELF;
        *object = nullptr;
        int count = 0;
        parent_.GetChildCount(&count);
        int target = row_;
        if (direction == wxNAVDIR_NEXT || direction == wxNAVDIR_DOWN) ++target;
        else if (direction == wxNAVDIR_PREVIOUS || direction == wxNAVDIR_UP) --target;
        else return wxACC_FALSE;
        return target > 0 && target <= count ? parent_.GetChild(target, object) : wxACC_FALSE;
    }

private:
    AccessibleListBox& parent_;
    wxWeakRef<wxListBox> list_;
    int row_;
};
}
#endif
