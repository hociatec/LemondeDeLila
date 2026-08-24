#include "shared/accessibility/application/NavigationController.h"

#include <utility>

namespace lila::shared::accessibility
{
NavigationController::Target::Target(wxWindow* window)
    : resolver_([window] { return window; })
{
}

NavigationController::Target::Target(Resolver resolver)
    : resolver_(std::move(resolver))
{
}

wxWindow* NavigationController::Target::Resolve() const
{
    return resolver_ ? resolver_() : nullptr;
}

NavigationController::Scope& NavigationController::Scope::Add(wxWindow* window)
{
    targets_.emplace_back(window);
    return *this;
}

NavigationController::Scope& NavigationController::Scope::Add(Resolver resolver)
{
    targets_.emplace_back(std::move(resolver));
    return *this;
}

NavigationController::Scope& NavigationController::Scope::Add(std::initializer_list<wxWindow*> windows)
{
    for (wxWindow* window : windows)
    {
        Add(window);
    }
    return *this;
}

void NavigationController::Scope::Clear()
{
    targets_.clear();
}

bool NavigationController::Scope::Empty() const
{
    return targets_.empty();
}
}
