#pragma once

#include <cstddef>
#include <functional>

#include <wx/access.h>
#include <wx/listbox.h>
#include <wx/string.h>
#include <wx/weakref.h>

namespace lila::shared::accessibility
{
using AccessibleListActivatedHandler = std::function<void(std::size_t)>;

#if wxUSE_ACCESSIBILITY
class AccessibleListBox final : public wxAccessible
{
public:
    enum class RoleMode
    {
        Menu,
        List,
    };

    AccessibleListBox(
        wxListBox& list,
        AccessibleListActivatedHandler onActivated,
        RoleMode roleMode);

    wxAccStatus GetRole(int childId, wxAccRole* role) override;
    wxAccStatus GetName(int childId, wxString* name) override;
    wxAccStatus GetChild(int childId, wxAccessible** child) override;
    wxAccStatus GetChildCount(int* childCount) override;
    wxAccStatus GetState(int childId, long* state) override;
    wxAccStatus GetFocus(int* childId, wxAccessible** child) override;
    wxAccStatus DoDefaultAction(int childId) override;
    wxAccStatus Select(int childId, wxAccSelectionFlags selectFlags) override;
    wxAccStatus GetDefaultAction(int childId, wxString* actionName) override;

private:
    [[nodiscard]] wxListBox* List() const noexcept;
    [[nodiscard]] bool IsValidChild(int childId) const noexcept;

    wxWeakRef<wxListBox> list_;
    AccessibleListActivatedHandler onActivated_;
    RoleMode roleMode_;
};
#endif

void ConfigureListBoxAsAccessibleMenu(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListActivatedHandler onActivated);

void ConfigureListBoxAsAccessibleList(
    wxListBox& list,
    const wxString& accessibleName,
    AccessibleListActivatedHandler onActivated);
}
