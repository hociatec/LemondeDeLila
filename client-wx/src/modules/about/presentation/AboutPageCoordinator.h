#pragma once

#include <functional>
#include <wx/string.h>

#include "shared/ui/navigation/NavigationStack.h"

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::about::presentation
{
class AboutFrame;

class AboutPageCoordinator final
{
public:
    enum class Page
    {
        Root,
        Shortcuts,
        Info,
        ContactAdmin,
    };

    struct NavigationSnapshot final
    {
        Page page;
        int selectedIndex = -1;
    };

    struct Callbacks final
    {
        std::function<void(const wxString&)> updateStatus;
        std::function<void()> onCloseRequested;
    };

    AboutPageCoordinator(
        AboutFrame& frame,
        lila::modules::session::application::SessionStore& sessionStore,
        Callbacks callbacks) noexcept;

    void ShowPage(Page page, bool pushCurrentToHistory = false, int restoreSelection = -1);
    void ActivateRootItem(std::size_t index);
    void FocusCurrentPage() const;
    void HandleEscape();

private:
    [[nodiscard]] NavigationSnapshot CaptureSnapshot() const;
    void RestoreSnapshot(const NavigationSnapshot& snapshot);
    void ApplyPageContent(Page page, int restoreSelection);
    void BuildRootMenuItems() const;
    void BuildInfoItems() const;

    AboutFrame& frame_;
    lila::modules::session::application::SessionStore& sessionStore_;
    Callbacks callbacks_;
    Page currentPage_ = Page::Root;
    lila::shared::ui::navigation::NavigationStack<NavigationSnapshot> navigationHistory_;
};
}
