#include "shared/accessibility/presentation/AccessibleMenu.h"

#include <utility>

#if wxUSE_ACCESSIBILITY
namespace lila::shared::accessibility
{
AccessibleListBox::AccessibleListBox(
    wxListBox& list,
    AccessibleListActivatedHandler onActivated,
    RoleMode roleMode)
    : wxAccessible(&list),
      list_(&list),
      onActivated_(std::move(onActivated)),
      roleMode_(roleMode)
{
}

wxAccStatus AccessibleListBox::GetRole(int childId, wxAccRole* role)
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

wxAccStatus AccessibleListBox::GetName(int childId, wxString* name)
{
    if (name == nullptr)
    {
        return wxACC_INVALID_ARG;
    }

    wxListBox* list = List();
    if (childId == wxACC_SELF)
    {
        *name = list != nullptr ? list->GetName() : wxString();
        return wxACC_OK;
    }
    if (list == nullptr || !IsValidChild(childId))
    {
        return wxACC_INVALID_ARG;
    }

    *name = list->GetString(static_cast<unsigned int>(childId - 1));
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::GetChild(int childId, wxAccessible** child)
{
    if (child == nullptr || !IsValidChild(childId))
    {
        return wxACC_INVALID_ARG;
    }
    *child = nullptr;
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::GetChildCount(int* childCount)
{
    if (childCount == nullptr)
    {
        return wxACC_INVALID_ARG;
    }
    wxListBox* list = List();
    *childCount = list != nullptr ? static_cast<int>(list->GetCount()) : 0;
    return wxACC_OK;
}

wxAccStatus AccessibleListBox::GetState(int childId, long* state)
{
    if (state == nullptr)
    {
        return wxACC_INVALID_ARG;
    }

    wxListBox* list = List();
    if (childId == wxACC_SELF)
    {
        *state = wxACC_STATE_SYSTEM_FOCUSABLE;
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
    if (list->GetSelection() == childId - 1)
    {
        *state |= wxACC_STATE_SYSTEM_SELECTED;
        if (list->HasFocus())
        {
            *state |= wxACC_STATE_SYSTEM_FOCUSED;
        }
    }
    return wxACC_OK;
}
}
#endif
