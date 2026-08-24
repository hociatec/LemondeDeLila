#pragma once

#include <functional>
#include <memory>

#include "shared/accessibility/FocusManager.h"

class wxWindow;

namespace lila::shared::accessibility
{
class FocusTransition final
{
public:
    using PlanBuilder = std::function<FocusManager::Plan()>;

    FocusTransition();
    ~FocusTransition();

    FocusTransition(const FocusTransition&) = delete;
    FocusTransition& operator=(const FocusTransition&) = delete;

    void Remember(wxWindow* scope);
    [[nodiscard]] bool Restore(wxWindow* scope);
    void Schedule(wxWindow& owner, wxWindow* scope, PlanBuilder buildFallbackPlan);
    void Forget(wxWindow* scope);
    void Clear();

private:
    struct State;
    std::shared_ptr<State> state_;
};
}
