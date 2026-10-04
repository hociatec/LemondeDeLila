#include "shared/accessibility/presentation/FocusCoordinator.h"

#include <utility>

#include <wx/weakref.h>
#include <wx/window.h>

namespace lila::shared::accessibility
{
bool FocusCoordinator::Apply(
    const FocusManager::Plan& plan,
    const FocusManager::BeforeFocus& beforeFocus)
{
    return FocusManager::Focus(plan, beforeFocus);
}

void FocusCoordinator::Schedule(wxWindow& owner, PlanBuilder buildPlan)
{
    if (!buildPlan)
    {
        return;
    }

    ScheduleAction(
        owner,
        [buildPlan = std::move(buildPlan)]()
        {
            static_cast<void>(Apply(buildPlan()));
        });
}

void FocusCoordinator::ScheduleAction(wxWindow& owner, Action action)
{
    if (!action)
    {
        return;
    }

    wxWeakRef<wxWindow> weakOwner(&owner);
    owner.CallAfter(
        [weakOwner, action = std::move(action)]() mutable
        {
            if (weakOwner)
            {
                action();
            }
        });
}
}
