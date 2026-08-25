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

void AppNavigator::CloseApplication(bool forUpdate)
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

    if (forUpdate)
    {
        static_cast<void>(sessionStore_.PrepareUpdateRestart());
        FinishCloseApplication();
        return;
    }

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
}
