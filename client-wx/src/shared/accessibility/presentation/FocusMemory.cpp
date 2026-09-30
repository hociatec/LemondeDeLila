#include "shared/accessibility/presentation/FocusMemory.h"

#include <algorithm>

#include <wx/window.h>

#include "shared/accessibility/presentation/FocusCoordinator.h"
#include "shared/accessibility/presentation/FocusManager.h"
#include "shared/accessibility/presentation/NavigationController.h"

namespace lila::shared::accessibility
{
void FocusMemory::Remember(wxWindow* scope)
{
    PruneExpired();
    if (scope == nullptr)
    {
        return;
    }

    wxWindow* focused = wxWindow::FindFocus();
    if (focused != nullptr && focused->IsShownOnScreen() && focused->IsEnabled() &&
        focused->AcceptsFocus() &&
        NavigationController::IsDescendantOf(focused, scope))
    {
        const auto remembered = std::find_if(targets_.begin(), targets_.end(),
            [scope](const Entry& entry) { return entry.scope.get() == scope; });
        if (remembered == targets_.end())
            targets_.emplace_back(scope, focused);
        else
        {
            targets_.erase(remembered);
            targets_.emplace_back(scope, focused);
        }
    }
}

bool FocusMemory::Restore(wxWindow* scope)
{
    PruneExpired();
    const auto remembered = std::find_if(targets_.begin(), targets_.end(),
        [scope](const Entry& entry) { return entry.scope.get() == scope; });
    if (remembered == targets_.end())
    {
        return false;
    }

    wxWindow* target = remembered->target.get();
    if (target == nullptr ||
        !NavigationController::IsDescendantOf(target, scope) ||
        !target->IsShownOnScreen() ||
        !NavigationController::IsFocusable(target))
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
    std::erase_if(targets_, [scope](const Entry& entry) {
        return entry.scope.get() == nullptr || entry.scope.get() == scope;
    });
}

void FocusMemory::Clear()
{
    targets_.clear();
}

void FocusMemory::PruneExpired()
{
    std::erase_if(targets_, [](const Entry& entry) {
        return entry.scope.get() == nullptr || entry.target.get() == nullptr;
    });
}

std::size_t FocusMemory::RememberedScopeCount() const noexcept
{
    return targets_.size();
}
}
