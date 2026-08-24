#include "shared/accessibility/application/FocusMemory.h"

#include <wx/window.h>

#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/application/NavigationController.h"

namespace lila::shared::accessibility
{
void FocusMemory::Remember(wxWindow* scope)
{
    if (scope == nullptr)
    {
        return;
    }

    wxWindow* focused = wxWindow::FindFocus();
    if (focused != nullptr && NavigationController::IsDescendantOf(focused, scope))
    {
        targets_.insert_or_assign(scope, wxWeakRef<wxWindow>(focused));
    }
}

bool FocusMemory::Restore(wxWindow* scope)
{
    const auto remembered = targets_.find(scope);
    if (remembered == targets_.end())
    {
        return false;
    }

    wxWindow* target = remembered->second.get();
    if (target == nullptr || !NavigationController::IsDescendantOf(target, scope))
    {
        targets_.erase(remembered);
        return false;
    }

    FocusManager::Plan plan;
    plan.AddWindow(target);
    return FocusCoordinator::Apply(plan);
}

void FocusMemory::Forget(wxWindow* scope)
{
    if (scope != nullptr)
    {
        targets_.erase(scope);
    }
}

void FocusMemory::Clear()
{
    targets_.clear();
}
}
