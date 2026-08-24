#include "app/navigation/presentation/AppNavigator.h"

#include <utility>

#include <wx/app.h>
#include <wx/weakref.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/home/presentation/HomeFrame.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/Session.h"
#include "modules/social/application/SocialService.h"
#include "modules/user/domain/AuthenticationResult.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

void AppNavigator::ShowHome()
{
    auto* view = GetOrCreateView(ViewId::Home);
    ReplaceView(ViewId::Home, view);
}

void AppNavigator::ShowSession(std::size_t selectedIndex, bool resetInitialFocus)
{
    lila::shared::logging::LogInfo("Navigator", "ShowSession(): begin.");
    lastMainMenuSelection_ = selectedIndex;
    if (!sessionStore_.HasActiveSession())
    {
        lila::shared::logging::LogWarning("Navigator", "ShowSession(): no active session, fallback to home.");
        ShowHome();
        return;
    }

    presenceMonitor_.Start();
    auto* view = GetOrCreateView(ViewId::MainMenu);
    if (resetInitialFocus)
    {
        focusTransition_.Forget(view);
    }
    ReplaceView(ViewId::MainMenu, view);
    PrewarmSessionData();
}

void AppNavigator::CloseApplication()
{
    if (closing_ || closeFinalized_)
    {
        return;
    }
    closing_ = true;
    audioService_.ShutdownImmediately();
    presenceMonitor_.Stop();
    if (hostFrame_ != nullptr) hostFrame_->Hide();
    ResetSessionViews();
    ResetView(ViewId::Home);
    currentViewId_ = ViewId::None;
    currentView_ = nullptr;

    if (sessionRevocationTask_ != nullptr
        && !sessionRevocationTask_->IsCancellationRequested())
    {
        ArmCloseRevocationTimeout();
        return;
    }

    const wxWeakRef<HostFrame> weakFrame(hostFrame_);
    sessionRevocationTask_ = sessionStore_.RevokeTransientSessionAsync(
        [this, weakFrame]()
        {
            if (weakFrame)
            {
                weakFrame->CallAfter(
                    [this, weakFrame]()
                    {
                        if (weakFrame)
                        {
                            OnSessionRevocationFinished();
                        }
                    });
            }
        });
    if (sessionRevocationTask_ == nullptr)
    {
        FinishCloseApplication();
        return;
    }
    ArmCloseRevocationTimeout();
}

void AppNavigator::ArmCloseRevocationTimeout()
{
    if (hostFrame_ == nullptr)
    {
        FinishCloseApplication();
        return;
    }
    closeRevocationTimeout_ = std::make_unique<wxTimer>(hostFrame_);
    hostFrame_->Bind(
        wxEVT_TIMER,
        [this](wxTimerEvent&)
        {
            if (sessionRevocationTask_ != nullptr)
            {
                sessionRevocationTask_->RequestCancel();
                sessionRevocationTask_.reset();
            }
            FinishCloseApplication();
        },
        closeRevocationTimeout_->GetId());
    closeRevocationTimeout_->StartOnce(2500);
}

void AppNavigator::OnSessionRevocationFinished()
{
    sessionRevocationTask_.reset();
    if (closing_)
    {
        FinishCloseApplication();
    }
}

void AppNavigator::FinishCloseApplication()
{
    if (closeFinalized_)
    {
        return;
    }
    closeFinalized_ = true;
    if (closeRevocationTimeout_ != nullptr)
    {
        closeRevocationTimeout_->Stop();
        closeRevocationTimeout_.reset();
    }
    if (hostFrame_ != nullptr)
    {
        hostFrame_->SetCloseRequestedHandler({});
        hostFrame_->Destroy();
        hostFrame_ = nullptr;
    }
    if (wxTheApp != nullptr)
    {
        wxTheApp->ExitMainLoop();
    }
}

void AppNavigator::PrewarmSessionData()
{
    if (sessionDataPrewarmed_)
    {
        return;
    }

    sessionDataPrewarmed_ = true;
    auto* catalogService = &catalogService_;
    auto* socialService = &socialService_;
    catalogPrewarmTask_ = lila::shared::concurrency::RunAsync(
        [catalogService, socialService](std::stop_token stopToken)
        {
            static_cast<void>(catalogService->LoadShelves(stopToken));
            if (stopToken.stop_requested()) return;

            static_cast<void>(socialService->LoadFriends());
            if (stopToken.stop_requested()) return;

            static_cast<void>(socialService->LoadBlockedUsers());
            if (stopToken.stop_requested()) return;

            static_cast<void>(socialService->LoadProfile());
        },
        [](std::optional<lila::shared::errors::AppError> error)
        {
            if (error.has_value())
            {
                lila::shared::logging::LogWarning("SessionCache", "Background cache prewarm failed.");
            }
        },
        lila::shared::concurrency::BackgroundTaskPriority::Low,
        lila::shared::errors::CatalogLoadFailed);
}

void AppNavigator::OnLoginSucceeded(const modules::user::domain::AuthenticationResult& result)
{
    audioService_.Play(lila::modules::audio::domain::SoundCue::ClientConnected);
    modules::session::domain::Session session;
    session.userId = result.userId;
    session.username = result.username;
    session.token = result.token;
    session.refreshToken = result.refreshToken;
    session.expiresAt = result.expiresAt;
    sessionStore_.Open(std::move(session), result.rememberSession && optionsStore_.Current().restoreSessionOnStartup);
    ShowSession(0, true);
}

void AppNavigator::OnLogoutRequested(std::size_t)
{
    lastMainMenuSelection_ = 0;
    audioService_.Play(lila::modules::audio::domain::SoundCue::ClientDisconnected);
    messagingOpenedFromSocial_ = false;
    presenceMonitor_.Stop();
    const wxWeakRef<HostFrame> weakFrame(hostFrame_);
    sessionRevocationTask_ = sessionStore_.LogoutAsync(
        [this, weakFrame]()
        {
            if (weakFrame)
            {
                weakFrame->CallAfter(
                    [this, weakFrame]()
                    {
                        if (weakFrame)
                        {
                            OnSessionRevocationFinished();
                        }
                    });
            }
        });
    auto* home = dynamic_cast<modules::home::presentation::HomeFrame*>(GetOrCreateView(ViewId::Home));
    if (home != nullptr)
    {
        home->PrepareForLogout();
        focusTransition_.Forget(home);
    }
    ShowHome();
    ResetSessionViews();
}

void AppNavigator::ResetSessionViews()
{
    messagingOpenedFromSocial_ = false;
    sessionDataPrewarmed_ = false;
    if (catalogPrewarmTask_ != nullptr)
    {
        catalogPrewarmTask_->RequestCancel();
        catalogPrewarmTask_.reset();
    }
    catalogService_.ClearCache();
    socialService_.ClearCache();

    constexpr ViewId sessionViews[] = {
        ViewId::MainMenu, ViewId::Catalog, ViewId::JoinRooms, ViewId::Vault,
        ViewId::Room, ViewId::StoryBook, ViewId::Leaderboard, ViewId::Chat,
        ViewId::Messaging, ViewId::Social, ViewId::Presence, ViewId::About,
        ViewId::Options};
    for (const auto viewId : sessionViews)
    {
        ResetView(viewId);
    }
    focusTransition_.Clear();
}
}
