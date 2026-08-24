#include "shared/accessibility/FocusTransition.h"

#include <cstddef>
#include <utility>

#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/accessibility/FocusCoordinator.h"
#include "shared/accessibility/FocusMemory.h"

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

void FocusTransition::Schedule(wxWindow& owner, wxWindow* scope, PlanBuilder buildFallbackPlan)
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
        [weakState, weakScope, requestId, buildFallbackPlan = std::move(buildFallbackPlan)]() mutable
        {
            const auto state = weakState.lock();
            wxWindow* resolvedScope = weakScope.get();
            if (state == nullptr || state->requestId != requestId || resolvedScope == nullptr)
            {
                return;
            }

            if (!state->memory.Restore(resolvedScope))
            {
                static_cast<void>(FocusCoordinator::Apply(buildFallbackPlan()));
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
