#include "app/navigation/presentation/AppNavigator.h"

#include <exception>

#include <wx/app.h>
#include <wx/msgdlg.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "modules/session/application/SessionStore.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "modules/update/application/UpdateSignals.h"

namespace lila::app::navigation
{
AppNavigator::AppNavigator(
    AuthNavigationDependencies auth,
    GameNavigationDependencies game,
    SocialNavigationDependencies social,
    AudioNavigationDependencies audio)
    : loginUseCase_(auth.loginUseCase),
      registerUseCase_(auth.registerUseCase),
      sessionStore_(auth.sessionStore),
      optionsStore_(auth.optionsStore),
      catalogService_(game.catalogService),
      roomLobbyService_(game.roomLobbyService),
      roomSessionService_(game.roomSessionService),
      vaultService_(game.vaultService),
      storyBookService_(game.storyBookService),
      leaderboardService_(game.leaderboardService),
      chatService_(social.chatService),
      messagingService_(social.messagingService),
      socialService_(social.socialService),
      presenceMonitor_(social.presenceMonitor),
      audioService_(audio.audioService)
{
}

bool AppNavigator::Start()
{
    lila::shared::logging::LogInfo("Navigator", "Start() begin.");
    if (hostFrame_ == nullptr)
    {
        hostFrame_ = new HostFrame();
        hostFrame_->Bind(
            lila::shared::ui::controls::wxEVT_LILA_MENU_NAVIGATED,
            [this](wxCommandEvent&)
            {
                audioService_.Play(lila::modules::audio::domain::SoundCue::Navigation);
            });
        hostFrame_->Bind(
            lila::shared::ui::controls::wxEVT_LILA_MENU_ACTIVATED,
            [this](wxCommandEvent&)
            {
                audioService_.Play(lila::modules::audio::domain::SoundCue::Selection);
            });
        hostFrame_->SetPresenceRequestedHandler([this]() { ShowPresence(); });
        hostFrame_->SetCloseRequestedHandler(
            [this]()
            {
                if (closing_)
                {
                    return false;
                }
                const bool forcedUpdate = lila::modules::update::IsForcedUpdateRequested();
                if (!forcedUpdate && optionsStore_.Current().confirmExit &&
                    wxMessageBox(
                        wxString(L"Voulez-vous vraiment fermer l'application ?"),
                        wxString(L"Confirmer la fermeture"),
                        wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
                        hostFrame_) != wxYES)
                {
                    return false;
                }
                CloseApplication(forcedUpdate);
                return false;
            });
        if (wxTheApp != nullptr)
        {
            wxTheApp->SetTopWindow(hostFrame_);
        }
    }

    audioService_.Play(lila::modules::audio::domain::SoundCue::ClientOpened);
    lila::shared::logging::LogInfo(
        "Navigator",
        std::string("restoreSessionOnStartup=") +
            (optionsStore_.Current().restoreSessionOnStartup ? "true" : "false"));

    if (optionsStore_.Current().restoreSessionOnStartup)
    {
        try
        {
            if (sessionStore_.Restore())
            {
                lila::shared::logging::LogInfo("Navigator", "Stored session restored. Opening main menu.");
                ShowSession(0, true);
                return true;
            }
        }
        catch (const std::exception& error)
        {
            lila::shared::logging::LogWarning(
                "Navigator",
                std::string("Stored session restore failed. Clearing invalid session and opening home. ") + error.what());
            sessionStore_.Clear();
        }
    }

    lila::shared::logging::LogInfo("Navigator", "No stored session restored. Opening home.");
    ShowHome();
    return true;
}
}
