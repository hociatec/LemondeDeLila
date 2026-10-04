#include "shared/accessibility/presentation/FocusTransition.h"

#include <cstddef>
#include <utility>

#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/accessibility/presentation/FocusCoordinator.h"
#include "shared/accessibility/presentation/FocusMemory.h"

namespace lila::shared::accessibility
{
struct FocusTransition::State final
{
    FocusMemory memory;
    std::size_t requestId = 0;
};

FocusTransition::FocusTransition() : state_(std::make_shared<State>()) {}

FocusTransition::~FocusTransition() = default;

void FocusTransition::Remember(wxWindow* scope)
{
    state_->memory.Remember(scope);
}

bool FocusTransition::Restore(wxWindow* scope)
{
    return state_->memory.Restore(scope);
}

void FocusTransition::Schedule(
    wxWindow& owner,
    wxWindow* scope,
    PlanBuilder buildFallbackPlan,
    FocusManager::BeforeFocus beforeFocus)
{
    if (scope == nullptr || !buildFallbackPlan)
    {
        return;
    }

    const std::size_t requestId = ++state_->requestId;
    std::weak_ptr<State> weakState(state_);
    wxWeakRef<wxWindow> weakScope(scope);
    FocusCoordinator::ScheduleAction(
        owner,
        [weakState,
         weakScope,
         requestId,
         buildFallbackPlan = std::move(buildFallbackPlan),
         beforeFocus = std::move(beforeFocus)]() mutable
        {
            const auto state = weakState.lock();
            wxWindow* resolvedScope = weakScope.get();
            if (state == nullptr || state->requestId != requestId || resolvedScope == nullptr)
            {
                return;
            }

            if (!state->memory.Restore(resolvedScope, beforeFocus))
            {
                static_cast<void>(FocusCoordinator::Apply(
                    buildFallbackPlan(), beforeFocus));
            }
        });
}

void FocusTransition::Forget(wxWindow* scope)
{
    state_->memory.Forget(scope);
}

void FocusTransition::Clear()
{
    ++state_->requestId;
    state_->memory.Clear();
}
}
