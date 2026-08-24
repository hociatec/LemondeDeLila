#pragma once

#include <cstddef>
#include <functional>
#include <utility>

#include <wx/access.h>
#include <wx/listbox.h>
#include <wx/string.h>
#include <wx/weakref.h>

namespace lila::shared::accessibility
{
#if wxUSE_ACCESSIBILITY
class AccessibleListBox final : public wxAccessible
{
public:
    using ActivatedHandler = std::function<void(std::size_t)>;

    enum class RoleMode
    {
        Menu,
        List,
    };

    AccessibleListBox(wxListBox& list, ActivatedHandler onActivated, RoleMode roleMode)
        : wxAccessible(&list), list_(&list), onActivated_(std::move(onActivated)), roleMode_(roleMode)
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
            *role = roleMode_ == RoleMode::Menu ? wxROLE_SYSTEM_MENUPOPUP : wxROLE_SYSTEM_LIST;
            return wxACC_OK;
        }

        if (IsValidChild(childId))
        {
            *role = roleMode_ == RoleMode::List ? wxROLE_SYSTEM_LISTITEM : wxROLE_SYSTEM_MENUITEM;
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
            wxListBox* list = List();
            *name = list != nullptr ? list->GetName() : wxString();
            return wxACC_OK;
        }

        wxListBox* list = List();
        if (list == nullptr || !IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        *name = list->GetString(static_cast<unsigned int>(childId - 1));
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

        wxListBox* list = List();
        *childCount = list != nullptr ? static_cast<int>(list->GetCount()) : 0;
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
            wxListBox* list = List();
            if (list == nullptr)
            {
                *state |= wxACC_STATE_SYSTEM_INVISIBLE;
                return wxACC_OK;
            }
            if (!list->IsEnabled())
            {
                *state |= wxACC_STATE_SYSTEM_UNAVAILABLE;
            }
            if (!list->IsShownOnScreen())
            {
                *state |= wxACC_STATE_SYSTEM_INVISIBLE;
            }
            if (list->HasFocus())
            {
                *state |= wxACC_STATE_SYSTEM_FOCUSED;
            }
            return wxACC_OK;
        }

        wxListBox* list = List();
        if (list == nullptr || !IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        *state = wxACC_STATE_SYSTEM_FOCUSABLE | wxACC_STATE_SYSTEM_SELECTABLE;
        if (!list->IsEnabled())
        {
            *state |= wxACC_STATE_SYSTEM_UNAVAILABLE;
        }
        if (!list->IsShownOnScreen())
        {
            *state |= wxACC_STATE_SYSTEM_INVISIBLE;
        }

        const int itemIndex = childId - 1;
        if (list->GetSelection() == itemIndex)
        {
            *state |= wxACC_STATE_SYSTEM_SELECTED;
            if (list->HasFocus())
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
        wxListBox* list = List();
        if (list == nullptr || !list->HasFocus())
        {
            *childId = 0;
            return wxACC_OK;
        }

        const int selection = list->GetSelection();
        *childId = selection == wxNOT_FOUND ? wxACC_SELF : selection + 1;
        return wxACC_OK;
    }

    wxAccStatus DoDefaultAction(int childId) override
    {
        wxListBox* list = List();
        if (list == nullptr || !IsValidChild(childId))
        {
            return childId == wxACC_SELF ? wxACC_NOT_SUPPORTED : wxACC_INVALID_ARG;
        }

        const int itemIndex = childId - 1;
        list->SetSelection(itemIndex);
        list->SetFocus();
        if (onActivated_)
        {
            onActivated_(static_cast<std::size_t>(itemIndex));
        }
        return wxACC_OK;
    }

    wxAccStatus Select(int childId, wxAccSelectionFlags selectFlags) override
    {
        wxListBox* list = List();
        if (list == nullptr || !IsValidChild(childId))
        {
            return wxACC_INVALID_ARG;
        }

        const int itemIndex = childId - 1;
        if ((selectFlags & wxACC_SEL_TAKESELECTION) != 0 ||
            (selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
        {
            list->SetSelection(itemIndex);
        }
        if ((selectFlags & wxACC_SEL_TAKEFOCUS) != 0)
        {
            list->SetFocus();
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

        if (roleMode_ == RoleMode::List)
        {
            return wxACC_NOT_SUPPORTED;
        }

        *actionName = wxString(L"Ouvrir");
        return wxACC_OK;
    }

private:
    [[nodiscard]] wxListBox* List() const noexcept
    {
        return list_.get();
    }

    [[nodiscard]] bool IsValidChild(int childId) const noexcept
    {
        wxListBox* list = List();
        return list != nullptr && childId > 0 && static_cast<unsigned int>(childId) <= list->GetCount();
    }

    wxWeakRef<wxListBox> list_;
    ActivatedHandler onActivated_;
    RoleMode roleMode_;
};

inline void ConfigureListBoxAsAccessibleMenu(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListBox::ActivatedHandler onActivated)
{
    list.SetName(accessibleName);
    list.SetAccessible(new AccessibleListBox(list, std::move(onActivated), AccessibleListBox::RoleMode::Menu));
}

inline void ConfigureListBoxAsAccessibleList(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListBox::ActivatedHandler onActivated)
{
    list.SetName(accessibleName);
    list.SetAccessible(new AccessibleListBox(list, std::move(onActivated), AccessibleListBox::RoleMode::List));
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

inline void ConfigureListBoxAsAccessibleList(
    wxListBox& list,
    const wxString& accessibleName,
    std::function<void(std::size_t)> onActivated)
{
    (void)onActivated;
    list.SetName(accessibleName);
}

#endif
}
