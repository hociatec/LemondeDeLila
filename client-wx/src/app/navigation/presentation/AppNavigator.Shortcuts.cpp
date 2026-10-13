#include "app/navigation/presentation/AppNavigator.h"
#include "app/navigation/presentation/HostFrame.h"
#include "modules/shortcuts/application/ShortcutStore.h"
#include "modules/shortcuts/presentation/ShortcutManagerFrame.h"
#include "modules/shortcuts/presentation/ShortcutKeys.h"
#include "modules/session/application/SessionStore.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/rooms/presentation/shell/RoomPanel.h"
#include "modules/about/presentation/AboutFrame.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>
#include <wx/app.h>

namespace lila::app::navigation
{
using domain::ViewId;
void AppNavigator::EnsureShortcutsLoaded()
{
    const int id = sessionStore_.Current().userId.value;
    if (shortcutsUserId_ == id) return;
    shortcutsUserId_ = id;
    shortcutStore_.Activate(id);
    auto* store = &shortcutStore_;
    const wxWeakRef<HostFrame> weak(hostFrame_);
    const std::weak_ptr<int> lifetime(lifetimeToken_);
    shortcutsTask_ = lila::shared::concurrency::RunAsync(
        [store, id](std::stop_token stop) { (void)store->Load(id, stop); },
        [this, weak, lifetime, id](std::optional<lila::shared::errors::AppError> error)
        {
            if (!error) return;
            wxTheApp->CallAfter([this, weak, lifetime, id]
            {
                if (weak && !lifetime.expired() && shortcutsUserId_ == id) shortcutsUserId_ = 0;
            });
        });
    if (!shortcutsTask_->WasAccepted()) shortcutsUserId_ = 0;
}
void AppNavigator::ShowShortcuts(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* view = dynamic_cast<modules::shortcuts::presentation::ShortcutManagerFrame*>(views_.Get(ViewId::Shortcuts));
    if (!view)
    {
        const auto session = sessionStore_.Current();
        view = new modules::shortcuts::presentation::ShortcutManagerFrame(
            hostFrame_->ContentParent(), shortcutStore_, catalogService_, session.userId.value,
            session.IsAdmin(), optionsStore_.Current().general.enableBetaGames,
            [this] { ShowSession(lastMainMenuSelection_); });
        views_.Set(ViewId::Shortcuts, view);
    }
    ReplaceView(ViewId::Shortcuts, view);
    view->SetAccess(sessionStore_.Current().IsAdmin(), optionsStore_.Current().general.enableBetaGames);
    view->Reload();
}
bool AppNavigator::ReturnFromShortcut()
{
    const auto target = shortcutReturnView_;
    shortcutReturnView_ = ViewId::None;
    if (target == ViewId::None || target == currentViewId_) return false;
    auto* view = views_.Get(target);
    if (!view) return false;
    ReplaceView(target, view);
    return true;
}
bool AppNavigator::HandleShortcutEvent(wxEvent& event)
{
    if (event.GetEventType() == wxEVT_KEY_UP)
    {
        shortcutHeldKey_ = 0;
        return false;
    }
    if (event.GetEventType() != wxEVT_CHAR_HOOK || closing_ || !hostFrame_ ||
        !hostFrame_->IsActive() || !hostFrame_->IsEnabled() || !sessionStore_.HasActiveSession()) return false;
    auto* focus = wxWindow::FindFocus();
    if (!focus || wxGetTopLevelParent(focus) != hostFrame_) return false;
    auto& key = static_cast<wxKeyEvent&>(event);
    const auto chord = modules::shortcuts::presentation::ShortcutChord(key);
    if (chord.empty()) { shortcutHeldKey_ = 0; return false; }
    const int userId = sessionStore_.Current().userId.value;
    for (const auto& item : shortcutStore_.Current(userId).items)
    {
        if (!item.enabled || item.chord != chord) continue;
        if (shortcutHeldKey_ == key.GetKeyCode()) return true;
        shortcutHeldKey_ = key.GetKeyCode();
        const std::weak_ptr<int> lifetime(lifetimeToken_);
        const auto origin = currentViewId_;
        hostFrame_->CallAfter([this, lifetime, userId, origin, target = item.target]
        {
            if (lifetime.expired() || closing_ || currentViewId_ != origin ||
                sessionStore_.Current().userId.value != userId || !hostFrame_->IsEnabled() ||
                wxGetTopLevelParent(wxWindow::FindFocus()) != hostFrame_) return;
            ExecuteShortcut(target);
        });
        return true;
    }
    return false;
}
void AppNavigator::ExecuteShortcut(const std::string& target)
{
    auto* room = dynamic_cast<modules::rooms::presentation::RoomPanel*>(views_.Get(ViewId::Room));
    if (target == "return_table")
    {
        if (room && room->CurrentRoomId() > 0)
        { shortcutReturnView_ = ViewId::None; ReplaceView(ViewId::Room, room); }
        else wxMessageBox(L"Vous n'avez aucune table en cours.", L"Raccourcis", wxOK, hostFrame_);
        return;
    }
    if (currentViewId_ == ViewId::Shortcuts && !currentView_->IsEnabled()) return;
    const bool inRoom = room && room->CurrentRoomId() > 0;
    if (currentViewId_ == ViewId::Room && (!inRoom || !room->CanOpenShortcut()))
    {
        wxMessageBox(L"Attendez la fin de l'opération en cours sur votre table avant de naviguer.", L"Raccourcis", wxOK, hostFrame_);
        return;
    }
    if (inRoom && target != "chat" && target != "messaging" && target != "inbox" &&
        target != "options" && target != "contact" && target != "shortcuts")
    {
        wxMessageBox(L"Quittez d'abord votre table pour ouvrir cette destination.", L"Table en cours", wxOK, hostFrame_);
        return;
    }
    if (target == "admin" && !sessionStore_.Current().IsAdmin())
    { wxMessageBox(L"Accès administrateur indisponible.", L"Raccourcis", wxOK, hostFrame_); return; }
    if (target.starts_with("game:")) { OpenShortcutGame(target.substr(5)); return; }
    ViewId next = ViewId::None;
    if (target == "main_menu") next = ViewId::MainMenu;
    else if (target == "catalog") next = ViewId::Catalog;
    else if (target == "chat") next = ViewId::Chat;
    else if (target == "messaging" || target == "inbox") next = ViewId::Messaging;
    else if (target == "social") next = ViewId::Social;
    else if (target == "options") next = ViewId::Options;
    else if (target == "contact") next = ViewId::About;
    else if (target == "shortcuts") next = ViewId::Shortcuts;
    else if (target == "admin") next = ViewId::Admin;
    else if (target == "leaderboard") next = ViewId::Leaderboard;
    else if (target == "vault") next = ViewId::Vault;
    if (next == ViewId::None) return;
    if (next == currentViewId_ && target != "inbox" && target != "contact") return;
    if (next != currentViewId_ && shortcutReturnView_ == ViewId::None)
        shortcutReturnView_ = inRoom ? ViewId::Room : currentViewId_;
    if (next == ViewId::Shortcuts) { ShowShortcuts(lastMainMenuSelection_); return; }
    if (next == ViewId::Chat) { ShowChat(lastMainMenuSelection_); return; }
    if (next == ViewId::Leaderboard) { ShowLeaderboard(); return; }
    if (next == ViewId::Vault) { ShowVault(); return; }
    auto* view = GetOrCreateView(next);
    if (next == ViewId::Messaging) messagingOpenedFromSocial_ = false;
    ReplaceView(next, view);
    if (target == "contact") dynamic_cast<modules::about::presentation::AboutFrame*>(view)->OpenContactPage();
    if (target == "inbox") dynamic_cast<modules::messaging::presentation::MessagingFrame*>(view)->OpenInboxShortcut();
}
}
