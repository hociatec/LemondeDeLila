#include "shared/accessibility/application/FocusManager.h"

#include <utility>

namespace lila::shared::accessibility
{
FocusManager::Plan& FocusManager::Plan::AddWindow(wxWindow* window)
{
    resolvers_.push_back([window]() { return window; });
    return *this;
}

FocusManager::Plan& FocusManager::Plan::AddResolver(Resolver resolver)
{
    resolvers_.push_back(std::move(resolver));
    return *this;
}

FocusManager::Plan& FocusManager::Plan::AddScope(ScopeProvider scopeProvider, ScopeEdge edge)
{
    resolvers_.push_back(
        [scopeProvider = std::move(scopeProvider), edge]()
        {
            const auto scope = scopeProvider ? scopeProvider() : NavigationController::Scope{};
            return edge == ScopeEdge::Last
                ? NavigationController::Last(scope)
                : NavigationController::First(scope);
        });
    return *this;
}

bool FocusManager::Focus(const Plan& plan)
{
    for (const auto& resolver : plan.resolvers_)
    {
        if (!resolver)
        {
            continue;
        }

        if (NavigationController::Focus(resolver()))
        {
            return true;
        }
    }

    return false;
}
}
