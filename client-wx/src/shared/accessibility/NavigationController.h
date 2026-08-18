#pragma once

#include <algorithm>
#include <functional>
#include <initializer_list>
#include <utility>
#include <vector>

#include <wx/defs.h>
#include <wx/event.h>
#include <wx/window.h>

namespace lila::shared::accessibility
{
// Centralized focus/navigation engine for wxWidgets presentation code.
// Screens declare focus scopes; this component owns filtering, cyclic movement,
// boundary wrapping and the standard Tab/Shift+Tab bindings.
class NavigationController final
{
public:
    using Resolver = std::function<wxWindow*()>;
    using Predicate = std::function<bool()>;

    class Target final
    {
    public:
        Target() = default;
        explicit Target(wxWindow* window) : resolver_([window] { return window; }) {}
        explicit Target(Resolver resolver) : resolver_(std::move(resolver)) {}

        [[nodiscard]] wxWindow* Resolve() const
        {
            return resolver_ ? resolver_() : nullptr;
        }

    private:
        Resolver resolver_;
    };

    class Scope final
    {
    public:
        Scope& Add(wxWindow* window)
        {
            targets_.emplace_back(window);
            return *this;
        }

        Scope& Add(Resolver resolver)
        {
            targets_.emplace_back(std::move(resolver));
            return *this;
        }

        Scope& Add(std::initializer_list<wxWindow*> windows)
        {
            for (wxWindow* window : windows)
            {
                Add(window);
            }
            return *this;
        }

        void Clear() { targets_.clear(); }
        [[nodiscard]] bool Empty() const { return targets_.empty(); }

    private:
        friend class NavigationController;
        std::vector<Target> targets_;
    };

    using ScopeProvider = std::function<Scope()>;

    enum class Direction
    {
        Forward,
        Backward,
    };

    enum class Boundary
    {
        Clamp,
        Wrap,
    };

    [[nodiscard]] static bool IsFocusable(const wxWindow* window)
    {
        return window != nullptr && window->IsShown() && window->IsEnabled() && window->AcceptsFocus();
    }

    [[nodiscard]] static std::vector<wxWindow*> Resolve(const Scope& scope)
    {
        std::vector<wxWindow*> result;
        result.reserve(scope.targets_.size());
        for (const Target& target : scope.targets_)
        {
            wxWindow* window = target.Resolve();
            if (IsFocusable(window) && std::find(result.begin(), result.end(), window) == result.end())
            {
                result.push_back(window);
            }
        }
        return result;
    }

    [[nodiscard]] static wxWindow* First(const Scope& scope)
    {
        const auto controls = Resolve(scope);
        return controls.empty() ? nullptr : controls.front();
    }

    [[nodiscard]] static wxWindow* Last(const Scope& scope)
    {
        const auto controls = Resolve(scope);
        return controls.empty() ? nullptr : controls.back();
    }

    [[nodiscard]] static bool Contains(const Scope& scope, wxWindow* window)
    {
        const auto controls = Resolve(scope);
        return std::find(controls.begin(), controls.end(), window) != controls.end();
    }

    static bool Focus(wxWindow* window)
    {
        if (!IsFocusable(window))
        {
            return false;
        }
        if (wxWindow::FindFocus() != window)
        {
            window->SetFocus();
        }
        return true;
    }

    static bool FocusFirst(const Scope& scope)
    {
        return Focus(First(scope));
    }

    static bool FocusLast(const Scope& scope)
    {
        return Focus(Last(scope));
    }

    static bool Move(
        const Scope& scope,
        Direction direction,
        Boundary boundary = Boundary::Wrap,
        wxWindow* focused = wxWindow::FindFocus())
    {
        const auto controls = Resolve(scope);
        if (controls.empty())
        {
            return false;
        }

        auto current = std::find(controls.begin(), controls.end(), focused);
        if (current == controls.end())
        {
            return direction == Direction::Backward ? Focus(controls.back()) : Focus(controls.front());
        }

        std::size_t index = static_cast<std::size_t>(std::distance(controls.begin(), current));
        std::size_t target = index;
        if (direction == Direction::Backward)
        {
            if (index > 0)
            {
                target = index - 1;
            }
            else if (boundary == Boundary::Wrap)
            {
                target = controls.size() - 1;
            }
        }
        else
        {
            if (index + 1 < controls.size())
            {
                target = index + 1;
            }
            else if (boundary == Boundary::Wrap)
            {
                target = 0;
            }
        }

        return Focus(controls[target]);
    }

    static bool MoveCyclic(const Scope& scope, bool reverse, wxWindow* focused = wxWindow::FindFocus())
    {
        return Move(scope, reverse ? Direction::Backward : Direction::Forward, Boundary::Wrap, focused);
    }

    static bool MoveLinear(const Scope& scope, bool reverse, wxWindow* focused = wxWindow::FindFocus())
    {
        return Move(scope, reverse ? Direction::Backward : Direction::Forward, Boundary::Clamp, focused);
    }

    // Wrap only when focus reaches a scope boundary (or comes from outside the owner).
    // Useful when native wx navigation should handle movement inside the scope.
    static bool WrapBoundary(const Scope& scope, bool reverse, wxWindow* owner = nullptr)
    {
        wxWindow* first = First(scope);
        wxWindow* last = Last(scope);
        wxWindow* focused = wxWindow::FindFocus();
        if (first == nullptr || last == nullptr)
        {
            return false;
        }
        if (focused == nullptr)
        {
            return reverse ? Focus(last) : Focus(first);
        }
        if (!reverse && focused == last)
        {
            return Focus(first);
        }
        if (reverse && focused == first)
        {
            return Focus(last);
        }
        if (owner != nullptr)
        {
            wxWindow* ancestor = focused;
            while (ancestor != nullptr && ancestor != owner)
            {
                ancestor = ancestor->GetParent();
            }
            if (ancestor == nullptr)
            {
                return reverse ? Focus(last) : Focus(first);
            }
        }
        return false;
    }

    static bool HandleTab(wxKeyEvent& event, const Scope& scope, Boundary boundary = Boundary::Wrap)
    {
        if (event.GetKeyCode() != WXK_TAB && event.GetKeyCode() != WXK_NUMPAD_TAB)
        {
            return false;
        }
        return Move(scope, event.ShiftDown() ? Direction::Backward : Direction::Forward, boundary);
    }

    static bool HandleVertical(wxKeyEvent& event, const Scope& scope, Boundary boundary = Boundary::Clamp)
    {
        const int key = event.GetKeyCode();
        if (key == WXK_UP || key == WXK_NUMPAD_UP)
        {
            return Move(scope, Direction::Backward, boundary);
        }
        if (key == WXK_DOWN || key == WXK_NUMPAD_DOWN)
        {
            return Move(scope, Direction::Forward, boundary);
        }
        return false;
    }


    static void BindTabNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        Predicate enabled = {},
        Boundary boundary = Boundary::Wrap)
    {
        window.Bind(
            wxEVT_CHAR_HOOK,
            [scopeProvider = std::move(scopeProvider), enabled = std::move(enabled), boundary](wxKeyEvent& event)
            {
                if (event.GetKeyCode() != WXK_TAB && event.GetKeyCode() != WXK_NUMPAD_TAB)
                {
                    event.Skip();
                    return;
                }
                if (enabled && !enabled())
                {
                    event.Skip();
                    return;
                }
                Scope scope = scopeProvider ? scopeProvider() : Scope{};
                if (!Move(scope, event.ShiftDown() ? Direction::Backward : Direction::Forward, boundary))
                {
                    event.Skip();
                }
            });
    }

    static void BindBoundaryTabNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        wxWindow* owner,
        Predicate enabled = {})
    {
        window.Bind(
            wxEVT_CHAR_HOOK,
            [scopeProvider = std::move(scopeProvider), owner, enabled = std::move(enabled)](wxKeyEvent& event)
            {
                if (event.GetKeyCode() != WXK_TAB && event.GetKeyCode() != WXK_NUMPAD_TAB)
                {
                    event.Skip();
                    return;
                }
                if (enabled && !enabled())
                {
                    event.Skip();
                    return;
                }
                Scope scope = scopeProvider ? scopeProvider() : Scope{};
                if (!WrapBoundary(scope, event.ShiftDown(), owner))
                {
                    event.Skip();
                }
            });
    }

    static void BindVerticalNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        Predicate enabled = {},
        Boundary boundary = Boundary::Clamp)
    {
        window.Bind(
            wxEVT_CHAR_HOOK,
            [scopeProvider = std::move(scopeProvider), enabled = std::move(enabled), boundary](wxKeyEvent& event)
            {
                const int key = event.GetKeyCode();
                if (key != WXK_UP && key != WXK_NUMPAD_UP && key != WXK_DOWN && key != WXK_NUMPAD_DOWN)
                {
                    event.Skip();
                    return;
                }
                if (enabled && !enabled())
                {
                    event.Skip();
                    return;
                }
                Scope scope = scopeProvider ? scopeProvider() : Scope{};
                if (!HandleVertical(event, scope, boundary))
                {
                    event.Skip();
                }
            });
    }
    static bool HandleDirectedTab(wxKeyEvent& event, wxWindow* backwardTarget, wxWindow* forwardTarget)
    {
        if (event.GetKeyCode() != WXK_TAB && event.GetKeyCode() != WXK_NUMPAD_TAB)
        {
            return false;
        }
        return Focus(event.ShiftDown() ? backwardTarget : forwardTarget);
    }

};
}
