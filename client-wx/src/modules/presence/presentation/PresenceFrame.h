#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"
#include "modules/presence/presentation/PresencePresentationModel.h"
#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NonFocusablePanel.h"

class wxStaticText;
class wxWindow;

namespace lila::modules::messaging::application { class MessagingService; }
namespace lila::modules::presence::application { class PresenceMonitor; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::social::application { class SocialService; }
namespace lila::shared::concurrency { class BackgroundTaskHandle; }
namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::presence::presentation
{
class PresenceFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;
    using OpenStoryBookRequestedHandler = std::function<void(int userId, std::string username)>;

    PresenceFrame(
        wxWindow* parent,
        lila::modules::presence::application::PresenceMonitor& presenceMonitor,
        lila::modules::social::application::SocialService& socialService,
        lila::modules::messaging::application::MessagingService& messagingService,
        lila::modules::session::application::SessionStore& sessionStore,
        OpenStoryBookRequestedHandler onOpenStoryBookRequested,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~PresenceFrame() override;

    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;
    void ResetForOpen();

private:
    enum class Page
    {
        Players,
        Actions
    };

    void BuildLayout();
    void BindEvents();
    void RefreshPlayers();
    void RebuildPlayers(std::optional<int> preferredPlayerId = std::nullopt, bool focusSelection = false);
    void RebuildActions();
    void ShowLoadingActions();
    void ActivateSelected();
    void ActivatePlayer();
    void RunSelectedAction();
    void LoadSocialState(int userId);
    void RunSocialMutation(const wxString& busyMessage, std::function<void()> worker, std::function<void()> onSuccess);
    void ShowBio(int userId, const wxString& username);
    void SendPrivateMessage(int userId, const wxString& username);
    void HandleEscape();
    void UpdateStatus(const wxString& message, bool isError = false);
    [[nodiscard]] std::optional<domain::PresencePlayer> SelectedPlayer() const;
    [[nodiscard]] bool IsSelf(const domain::PresencePlayer& player) const;
    [[nodiscard]] std::string SelectedActionId() const;

    lila::modules::presence::application::PresenceMonitor& presenceMonitor_;
    lila::modules::session::application::SessionStore& sessionStore_;
    std::unique_ptr<class PresenceActionController> actionController_;
    OpenStoryBookRequestedHandler onOpenStoryBookRequested_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    wxStaticText* titleLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* detailsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    Page page_ = Page::Players;
    std::vector<domain::PresencePlayer> players_;
    std::optional<domain::PresencePlayer> selectedPlayer_;
    std::optional<PresenceSocialState> socialState_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> activeTask_;
    bool busy_ = false;
};
}
