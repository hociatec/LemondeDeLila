#pragma once

#include <cstddef>
#include <functional>
#include <utility>

#include <wx/access.h>
#include <wx/listbox.h>
#include <wx/string.h>

namespace lila::shared::accessibility
{
#if wxUSE_ACCESSIBILITY
// Exposes a wxListBox used as an application navigation menu with menu/menu-item
// semantics instead of the native list/list-item semantics. The underlying
// wxListBox remains unchanged, so keyboard interaction and visual behaviour stay
// native while screen readers receive the role that matches the UI contract.
class AccessibleMenuList final : public wxAccessible
{
public:
    using ActivatedHandler = std::function<void(std::size_t)>;

    AccessibleMenuList(wxListBox& list, ActivatedHandler onActivated)
        : wxAccessible(&list), list_(list), onActivated_(std::move(onActivated))
    {
    }

    wxAccStatus GetRole(int childId, wxAccRole* role) override
    {
        if (role == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        if (childId == wxACC_SELF)
        {
            *role = wxROLE_SYSTEM_MENUPOPUP;
            return wxACC_OK;
        }

        if (IsValidChild(childId))
        {
            *role = wxROLE_SYSTEM_MENUITEM;
            return wxACC_OK;
        }

        return wxACC_INVALID_ARG;
    }

    wxAccStatus GetName(int childId, wxString* name) override
    {
        if (name == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        if (childId == wxACC_SELF)
        {
            *name = list_.GetName();
            return wxACC_OK;
        }

        if (!IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        *name = list_.GetString(static_cast<unsigned int>(childId - 1));
        return wxACC_OK;
    }


    wxAccStatus GetChild(int childId, wxAccessible** child) override
    {
        if (child == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        if (!IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        // Menu entries are simple accessible children of the native list box.
        *child = nullptr;
        return wxACC_OK;
    }

    wxAccStatus GetChildCount(int* childCount) override
    {
        if (childCount == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        *childCount = static_cast<int>(list_.GetCount());
        return wxACC_OK;
    }

    wxAccStatus GetState(int childId, long* state) override
    {
        if (state == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        if (childId == wxACC_SELF)
        {
            *state = wxACC_STATE_SYSTEM_FOCUSABLE;
            if (!list_.IsEnabled())
            {
                *state |= wxACC_STATE_SYSTEM_UNAVAILABLE;
            }
            if (!list_.IsShown())
            {
                *state |= wxACC_STATE_SYSTEM_INVISIBLE;
            }
            if (list_.HasFocus())
            {
                *state |= wxACC_STATE_SYSTEM_FOCUSED;
            }
            return wxACC_OK;
        }

        if (!IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        *state = wxACC_STATE_SYSTEM_FOCUSABLE | wxACC_STATE_SYSTEM_SELECTABLE;
        if (!list_.IsEnabled())
        {
            *state |= wxACC_STATE_SYSTEM_UNAVAILABLE;
        }

        const int itemIndex = childId - 1;
        if (list_.GetSelection() == itemIndex)
        {
            *state |= wxACC_STATE_SYSTEM_SELECTED;
            if (list_.HasFocus())
            {
                *state |= wxACC_STATE_SYSTEM_FOCUSED;
            }
        }
        return wxACC_OK;
    }

    wxAccStatus GetFocus(int* childId, wxAccessible** child) override
    {
        if (childId == nullptr || child == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        *child = nullptr;
        if (!list_.HasFocus())
        {
            *childId = 0;
            return wxACC_OK;
        }

        const int selection = list_.GetSelection();
        *childId = selection == wxNOT_FOUND ? wxACC_SELF : selection + 1;
        return wxACC_OK;
    }

    wxAccStatus DoDefaultAction(int childId) override
    {
        if (!IsValidChild(childId))
        {
            return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
        }

        const int itemIndex = childId - 1;
        list_.SetSelection(itemIndex);
        list_.SetFocus();
        if (onActivated_)
        {
            onActivated_(static_cast<std::size_t>(itemIndex));
        }
        return wxACC_OK;
    }

    wxAccStatus Select(int childId, wxAccSelectionFlags selectFlags) override
    {
        if (!IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        const int itemIndex = childId - 1;
        if ((selectFlags & wxACC_SEL_TAKESELECTION) != 0 ||
            (selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
        {
            list_.SetSelection(itemIndex);
        }
        if ((selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
        {
            list_.SetFocus();
        }
        return wxACC_OK;
    }

    wxAccStatus GetDefaultAction(int childId, wxString* actionName) override
    {
        if (actionName == nullptr)
        {
            return wxACC_INVALID_ARG;
        }

        if (!IsValidChild(childId))
        {
            return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
        }

        *actionName = wxString(L"Ouvrir");
        return wxACC_OK;
    }

private:
    [[nodiscard]] bool IsValidChild(int childId) const noexcept
    {
        return childId > 0 && static_cast<unsigned int>(childId) <= list_.GetCount();
    }

    wxListBox& list_;
    ActivatedHandler onActivated_;
};

inline void ConfigureListBoxAsAccessibleMenu(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleMenuList::ActivatedHandler onActivated)
{
    list.SetName(accessibleName);
    list.SetAccessible(new AccessibleMenuList(list, std::move(onActivated)));
}
#else
inline void ConfigureListBoxAsAccessibleMenu(
    wxListBox& list,
    const wxString& accessibleName,
    std::function<void(std::size_t)> onActivated)
{
    (void)onActivated;
    list.SetName(accessibleName);
}
#endif
}
