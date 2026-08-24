#pragma once

#include <functional>

#include "shared/accessibility/FocusManager.h"

class wxWindow;

namespace lila::shared::accessibility
{
class FocusCoordinator final
{
public:
    using PlanBuilder = std::function<FocusManager::Plan()>;
    using Action = std::function<void()>;

    [[nodiscard]] static bool Apply(const FocusManager::Plan& plan);
    static void Schedule(wxWindow& owner, PlanBuilder buildPlan);
    static void ScheduleAction(wxWindow& owner, Action action);
};
}
