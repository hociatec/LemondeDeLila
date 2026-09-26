#include "app/navigation/presentation/AppNavigator.h"

#include <chrono>

#include <wx/weakref.h>
#include <wx/window.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

namespace
{
// Kept in sync with resources/sounds/ClientOpened.wav (3.312018 seconds).
constexpr auto ClientOpenedDuration = std::chrono::milliseconds(3312);
}

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
    const bool enteringTavern = nextViewId == ViewId::Catalog && previousViewId != ViewId::Catalog;
    const bool openingStartupBackground = nextViewId == ViewId::MainMenu || enteringTavern;
    if (nextViewId != ViewId::Catalog && nextViewId != ViewId::MainMenu)
    {
        CancelScheduledBackgroundAudio();
    }
    const bool shouldDelayBackground = openingStartupBackground && clientOpenedAt_.has_value() &&
        std::chrono::steady_clock::now() - *clientOpenedAt_ < ClientOpenedDuration;
    if (shouldDelayBackground)
    {
        // Do not mask the client opening sound with a menu ambience.
        audioService_.SetBackground(lila::modules::audio::domain::AudioBackground::None);
        ScheduleBackgroundAudioAfterClientOpening(background, enteringTavern);
    }
    else
    {
        audioService_.SetBackground(background);
    }
    if (enteringTavern && !shouldDelayBackground)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::TavernOpened);
    }
    else if (previousViewId == ViewId::Catalog && nextViewId != ViewId::Catalog)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::TavernClosed);
    }
    if (!hostFrame_->IsShown())
    {
        hostFrame_->Show(true);
    }
    ApplyViewFocus(currentView_);

    const auto transitionElapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - transitionStartedAt);
    if (transitionElapsed >= std::chrono::milliseconds(100))
    {
        lila::shared::logging::LogWarning(
            "Navigator",
            "Slow view transition: " + std::to_string(transitionElapsed.count()) + " ms.");
    }
}

void AppNavigator::StartBackgroundAudio(
    lila::modules::audio::domain::AudioBackground background,
    bool playTavernOpened)
{
    audioService_.SetBackground(background);
    if (playTavernOpened)
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::TavernOpened);
    }
}

void AppNavigator::ScheduleBackgroundAudioAfterClientOpening(
    lila::modules::audio::domain::AudioBackground background,
    bool playTavernOpened)
{
    if (hostFrame_ == nullptr || !clientOpenedAt_.has_value())
    {
        StartBackgroundAudio(background, playTavernOpened);
        return;
    }

    const auto elapsed = std::chrono::steady_clock::now() - *clientOpenedAt_;
    const auto remaining = ClientOpenedDuration - std::chrono::duration_cast<std::chrono::milliseconds>(elapsed);
    if (remaining <= std::chrono::milliseconds::zero())
    {
        StartBackgroundAudio(background, playTavernOpened);
        return;
    }

    delayedBackground_ = background;
    delayedTavernOpened_ = playTavernOpened;
    if (startupBackgroundDelay_ == nullptr)
    {
        startupBackgroundDelay_ = std::make_unique<wxTimer>(hostFrame_);
        const int timerId = startupBackgroundDelay_->GetId();
        hostFrame_->Bind(wxEVT_TIMER, [this, timerId](wxTimerEvent& event)
        {
            if (startupBackgroundDelay_ == nullptr || event.GetId() != timerId ||
                !delayedBackground_.has_value())
            {
                return;
            }
            startupBackgroundDelay_->Stop();
            const auto background = *delayedBackground_;
            const bool playTavernOpened = delayedTavernOpened_;
            delayedBackground_.reset();
            delayedTavernOpened_ = false;
            const bool stillOnExpectedView =
                (background == lila::modules::audio::domain::AudioBackground::MainMenu &&
                    currentViewId_ == ViewId::MainMenu) ||
                (background == lila::modules::audio::domain::AudioBackground::Tavern &&
                    currentViewId_ == ViewId::Catalog);
            if (!closing_ && stillOnExpectedView)
            {
                StartBackgroundAudio(background, playTavernOpened);
            }
        }, timerId);
    }
    startupBackgroundDelay_->StartOnce(static_cast<int>(remaining.count()));
}

void AppNavigator::CancelScheduledBackgroundAudio()
{
    delayedBackground_.reset();
    delayedTavernOpened_ = false;
    if (startupBackgroundDelay_ != nullptr)
    {
        startupBackgroundDelay_->Stop();
        startupBackgroundDelay_.reset();
    }
}

void AppNavigator::ApplyViewFocus(wxWindow* view)
{
    if (view == nullptr || hostFrame_ == nullptr)
    {
        return;
    }

    wxWeakRef<wxWindow> weakView(view);
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
