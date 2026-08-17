#pragma once

#include <functional>
#include <vector>

#include <wx/frame.h>

class wxButton;
namespace lila::shared::ui::controls
{
class VerticalMenu;
}
class wxStaticText;
class wxTextCtrl;

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::about::presentation
{
class AboutFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    AboutFrame(
        lila::modules::session::application::SessionStore& sessionStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);

private:
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
        int selectedIndex = wxNOT_FOUND;
    };

    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void ShowPage(Page page, bool pushCurrentToHistory = false, int restoreSelection = wxNOT_FOUND);
    void BuildRootMenuItems();
    void BuildInfoItems();
    void FocusCurrentPage();
    void HandleEscape();
    void UpdateStatus(const wxString& message);
    [[nodiscard]] NavigationSnapshot CaptureSnapshot() const;
    void RestoreSnapshot(const NavigationSnapshot& snapshot);
    [[nodiscard]] wxString BuildShortcutsText() const;
    [[nodiscard]] wxString ResolveLocalUpdatedAt() const;

    lila::modules::session::application::SessionStore& sessionStore_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    Page currentPage_ = Page::Root;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* detailsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* itemsList_ = nullptr;
    wxTextCtrl* shortcutsTextCtrl_ = nullptr;
    wxTextCtrl* contactMessageCtrl_ = nullptr;
    wxButton* sendContactButton_ = nullptr;
    wxButton* cancelContactButton_ = nullptr;
    std::vector<NavigationSnapshot> navigationHistory_;
};
}
