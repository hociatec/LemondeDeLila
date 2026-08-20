#pragma once

#include <functional>
#include <initializer_list>
#include <vector>

#include <wx/defs.h>
#include <wx/event.h>
#include <wx/window.h>

namespace lila::shared::accessibility
{
class NavigationController final
{
public:
    using Resolver = std::function<wxWindow*()>;
    using Predicate = std::function<bool()>;
    using EscapeHandler = std::function<bool()>;

    class Target final
    {
    public:
        Target() = default;
        explicit Target(wxWindow* window);
        explicit Target(Resolver resolver);

        [[nodiscard]] wxWindow* Resolve() const;

    private:
        Resolver resolver_;
    };

    class Scope final
    {
    public:
        Scope& Add(wxWindow* window);
        Scope& Add(Resolver resolver);
        Scope& Add(std::initializer_list<wxWindow*> windows);

        void Clear();
        [[nodiscard]] bool Empty() const;

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

    [[nodiscard]] static bool IsTabKey(int keyCode) noexcept;
    [[nodiscard]] static bool IsVerticalKey(int keyCode) noexcept;
    [[nodiscard]] static std::size_t ComputeTargetIndex(
        std::size_t itemCount,
        std::size_t currentIndex,
        Direction direction,
        Boundary boundary = Boundary::Wrap) noexcept;
    [[nodiscard]] static bool IsFocusable(const wxWindow* window);
    [[nodiscard]] static bool IsDescendantOf(const wxWindow* window, const wxWindow* ancestor);
    [[nodiscard]] static std::vector<wxWindow*> Resolve(const Scope& scope);
    [[nodiscard]] static wxWindow* First(const Scope& scope);
    [[nodiscard]] static wxWindow* Last(const Scope& scope);
    [[nodiscard]] static bool Contains(const Scope& scope, wxWindow* window);

    static bool Focus(wxWindow* window);
    static bool FocusFirst(const Scope& scope);
    static bool FocusLast(const Scope& scope);
    static bool Move(
        const Scope& scope,
        Direction direction,
        Boundary boundary = Boundary::Wrap,
        wxWindow* focused = wxWindow::FindFocus());
    static bool MoveCyclic(const Scope& scope, bool reverse, wxWindow* focused = wxWindow::FindFocus());
    static bool MoveLinear(const Scope& scope, bool reverse, wxWindow* focused = wxWindow::FindFocus());
    static bool WrapBoundary(const Scope& scope, bool reverse, wxWindow* owner = nullptr);
    static bool HandleTab(wxKeyEvent& event, const Scope& scope, Boundary boundary = Boundary::Wrap);
    static bool HandleVertical(wxKeyEvent& event, const Scope& scope, Boundary boundary = Boundary::Clamp);
    static bool HandleEscapeBacktrack(
        wxWindow* currentContainer,
        wxWindow* fallbackTarget,
        wxWindow* focused = wxWindow::FindFocus());
    static void BindTabNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        Predicate enabled = {},
        Boundary boundary = Boundary::Wrap);
    static void BindEscapeNavigation(
        wxWindow& window,
        EscapeHandler handler,
        Predicate enabled = {});
    static void BindBoundaryTabNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        wxWindow* owner,
        Predicate enabled = {});
    static void BindVerticalNavigation(
        wxWindow& window,
        ScopeProvider scopeProvider,
        Predicate enabled = {},
        Boundary boundary = Boundary::Clamp);
    static bool HandleDirectedTab(wxKeyEvent& event, wxWindow* backwardTarget, wxWindow* forwardTarget);
};
}
