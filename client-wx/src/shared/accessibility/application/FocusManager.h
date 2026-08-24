#pragma once

#include <functional>
#include <vector>

#include <wx/window.h>

#include "shared/accessibility/application/NavigationController.h"

namespace lila::shared::accessibility
{
class FocusCoordinator;

// Shared focus resolver above NavigationController. Modules describe candidate
// targets and fallbacks; this class resolves the first focusable one and is the
// only place that should apply focus directly.
class FocusManager final
{
public:
    using Resolver = std::function<wxWindow*()>;
    using ScopeProvider = std::function<NavigationController::Scope()>;

    enum class ScopeEdge
    {
        First,
        Last,
    };

    class Plan final
    {
    public:
        Plan& AddWindow(wxWindow* window);
        Plan& AddResolver(Resolver resolver);
        Plan& AddScope(ScopeProvider scopeProvider, ScopeEdge edge = ScopeEdge::First);

    private:
        friend class FocusManager;
        std::vector<Resolver> resolvers_;
    };

private:
    friend class FocusCoordinator;
    [[nodiscard]] static bool Focus(const Plan& plan);
};
}
