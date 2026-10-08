#include "app/navigation/presentation/AppNavigator.h"

#include <chrono>
#include <utility>

#include <wx/weakref.h>
#include <wx/window.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "shared/accessibility/presentation/FocusPlanView.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

void AppNavigator::ReplaceView(ViewId nextViewId, wxWindow* nextView)
{
    const auto transitionStartedAt = std::chrono::steady_clock::now();
    lila::shared::logging::LogInfo("Navigator", "ReplaceView(): begin.");
    const ViewId previousViewId = currentViewId_;
    if (currentView_ != nullptr && currentView_ != nextView)
    {
        focusTransition_.Remember(currentView_);
    }
    currentViewId_ = nextViewId;
    currentView_ = nextView;
    // Opening the presence overlay must not replace the underlying activity.
    if (nextViewId != ViewId::Presence)
    {
        std::string context = "home";
        switch (nextViewId)
        {
        case ViewId::Room: context = "table"; break;
        case ViewId::Catalog: case ViewId::JoinRooms: context = "tavern"; break;
        case ViewId::Chat: context = "chat"; break;
        case ViewId::Messaging: context = "messaging"; break;
        case ViewId::Social: context = "social"; break;
        case ViewId::StoryBook: case ViewId::Leaderboard: context = "stats"; break;
        case ViewId::Admin: case ViewId::Options: case ViewId::Vault: context = "other"; break;
        default: break;
        }
        presenceMonitor_.SetContext(std::move(context));
    }

    if (hostFrame_ == nullptr)
    {
        return;
    }

    hostFrame_->SetContent(currentView_);
    if (previousViewId != ViewId::None && previousViewId != nextViewId)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::Navigation);
    }

    const auto background = nextViewId == ViewId::MainMenu
        ? lila::modules::audio::domain::AudioBackground::MainMenu
        : (nextViewId == ViewId::Catalog
            ? lila::modules::audio::domain::AudioBackground::Tavern
            : lila::modules::audio::domain::AudioBackground::None);
    audioService_.SetBackground(background);
    if (nextViewId == ViewId::Catalog && previousViewId != ViewId::Catalog)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::TavernOpened);
    }
    else if (previousViewId == ViewId::Catalog && nextViewId != ViewId::Catalog)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::TavernClosed);
    }
    if (!hostFrame_->IsShown() && previousViewId != ViewId::None)
    {
        hostFrame_->Show(true);
    }
    // At startup Application restores the initial view focus after Windows has
    // finished activating the host window. Focusing here as well interrupts
    // the screen reader while it is still announcing the application title.
    if (previousViewId != ViewId::None)
    {
        ApplyViewFocus(currentView_);
    }

    const auto transitionElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - transitionStartedAt);
    if (transitionElapsed >= std::chrono::milliseconds(100))
    {
        lila::shared::logging::LogWarning(
            "Navigator",
            "Slow view transition: " + std::to_string(transitionElapsed.count()) + " ms.");
    }
}

void AppNavigator::ApplyViewFocus(wxWindow* view, bool includeWindowContext)
{
    if (view == nullptr || hostFrame_ == nullptr)
    {
        return;
    }

    wxWeakRef<wxWindow> weakView(view);
    wxWeakRef<HostFrame> weakHost(hostFrame_);
    focusTransition_.Schedule(
        *hostFrame_,
        view,
        [weakView]()
        {
            auto* resolvedView = weakView.get();
            auto* focusView = dynamic_cast<lila::shared::accessibility::FocusPlanView*>(resolvedView);
            return focusView != nullptr
                ? focusView->BuildFocusPlan()
                : lila::shared::accessibility::FocusManager::Plan{};
        },
        includeWindowContext
            ? lila::shared::accessibility::FocusManager::BeforeFocus(
                  [weakHost](wxWindow* target)
                  {
                      if (auto* host = weakHost.get())
                          host->PrepareActivationFocusContext(target);
                  })
            : lila::shared::accessibility::FocusManager::BeforeFocus{});
}

void AppNavigator::PrepareInitialViewAnnouncement()
{
    if (hostFrame_ != nullptr) hostFrame_->BeginInitialFocusAnnouncement();
}

void AppNavigator::FocusInitialView()
{
    if (hostFrame_ == nullptr)
    {
        ApplyViewFocus(currentView_);
        return;
    }

    const std::weak_ptr<int> weakLifetime = lifetimeToken_;
    const wxWeakRef<wxWindow> weakView(currentView_);
    hostFrame_->CompleteInitialFocusAnnouncement(
        [this, weakLifetime, weakView](bool includeWindowContext)
        {
            if (weakLifetime.expired()) return;
            ApplyViewFocus(weakView.get(), includeWindowContext);
        });
}

void AppNavigator::FocusCurrentView()
{
    ApplyViewFocus(currentView_);
}

wxWindow* AppNavigator::GetOrCreateView(ViewId viewId)
{
    auto* view = views_.Get(viewId);
    if (view == nullptr)
    {
        if (currentView_ != nullptr && currentViewId_ != viewId)
        {
            focusTransition_.Remember(currentView_);
        }
        view = CreateView(viewId);
        views_.Set(viewId, view);
    }
    return view;
}

void AppNavigator::ResetView(ViewId viewId)
{
    auto* view = views_.Release(viewId);
    if (view == nullptr)
    {
        return;
    }
    if (hostFrame_ != nullptr)
    {
        hostFrame_->RemoveContent(view);
    }
    if (currentView_ == view)
    {
        currentView_ = nullptr;
        currentViewId_ = ViewId::None;
    }
    focusTransition_.Forget(view);
    view->Destroy();
}
}
