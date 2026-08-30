#pragma once

#include <cstddef>
#include <functional>
#include <optional>
#include <stop_token>
#include <string>
#include <unordered_set>
#include <vector>

#include <wx/panel.h>
#include <wx/weakref.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/actions/application/GameCommandSubmissionGuard.h"
#include "modules/gameplay/session/application/GameStartConfigurationFlow.h"
#include "modules/gameplay/session/domain/GameEvent.h"
#include "modules/gameplay/state/domain/GameState.h"
#include "modules/gameplay/history/presentation/GameLogCursor.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxKeyEvent;
class wxChoice;
class wxListBox;
class wxRearrangeCtrl;
class wxScrolledWindow;
class wxStaticText;
class wxTextCtrl;

namespace lila::modules::gameplay::application
{
class GameSessionService;
}

namespace lila::shared::errors
{
class AppError;
}

namespace lila::modules::gameplay::presentation::confirmation { class GameActionConfirmationPanel; }
namespace lila::modules::gameplay::presentation::hand { class GameHandPanel; }
namespace lila::modules::gameplay::presentation::dice { class GameDicePanel; }
namespace lila::modules::gameplay::presentation::grid { class GameGridPanel; }
namespace lila::modules::gameplay::presentation::movement { class GameMovementPanel; }
namespace lila::modules::gameplay::presentation::resources { class GameResourcesPanel; }
namespace lila::modules::gameplay::presentation::workflows { class GameWorkflowPanel; }
namespace lila::modules::gameplay::presentation::prompt { class GamePromptPanel; }
namespace lila::modules::gameplay::presentation::pawn_selection { class PawnSelectionPanel; }

namespace lila::modules::gameplay::presentation
{
class GamePlayPanel final : public wxPanel
{
public:
    using ZoneFocusRequestedHandler = std::function<void()>;
    using HistoryMessageHandler = std::function<void(const wxString&)>;
    using TableShortcutHandler = std::function<bool(wxKeyEvent&)>;
    using GameSoundEventHandler = std::function<void(
        const std::string&, const std::vector<int>& winnerPlayerIds)>;
    using RoomStartRequestedHandler = std::function<void()>;

    explicit GamePlayPanel(
        wxWindow* parent,
        application::GameSessionService& service);
    ~GamePlayPanel() override;

    void Open(int roomId, std::string gameType, std::string gameName, bool roomStarted = true);
    void CloseSession();
    [[nodiscard]] bool IsOpenFor(int roomId, const std::string& gameType) const;
    [[nodiscard]] bool IsOpen() const noexcept;
    [[nodiscard]] bool IsFinished() const noexcept;
    void SetZoneFocusRequestedHandler(ZoneFocusRequestedHandler handler);
    void SetHistoryMessageHandler(HistoryMessageHandler handler);
    void SetTableShortcutHandler(TableShortcutHandler handler);
    void SetGameSoundEventHandler(GameSoundEventHandler handler);
    void SetRoomStartRequestedHandler(RoomStartRequestedHandler handler);
    bool BeginRoomStart();
    void ShowRules();
    void SetRoomStarted(bool started);
    void NotifyRoomStartFailed(const wxString& message);
    bool HandleZoneActivation();
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] wxWindow* PreferredNavigationTarget() const;

private:
    void BuildLayout();
    void BindEvents();
    void AttachEventHandler();
    void StartJoin();
    void PrepareAndExecuteAction(domain::GameAction action);
    void ExecuteAction(domain::GameAction action);
    void RequestRefresh();
    void SendKey(std::string key);
    void SubmitInputCommand(
        std::string protocolCommand,
        std::function<void(std::stop_token)> command,
        std::string failureMessage);
    void RunCommand(
        std::function<void(std::stop_token)> command,
        std::string failureMessage,
        std::function<void(GamePlayPanel&, const lila::shared::errors::AppError&)>
            onFailure = {});
    void ApplyState(domain::GameState state);
    void HandleEvent(domain::GameEvent event);
    void ActivateSelectedLine();
    bool ActivateSelectedPendingChoice();
    bool ActivateSelectedHandCard();
    bool ActivateSelectedDie();
    bool ActivateSelectedGridCell();
    void SyncInlinePrompt();
    void ShowInlinePrompt(domain::GameAction action);
    void SyncContentVisibility();
    [[nodiscard]] bool IsInlinePromptVisible() const;
    [[nodiscard]] bool IsConfirmationVisible() const;
    bool HandleShortcut(const std::string& normalizedKey);
    bool HandleInterfaceShortcut(const std::string& id);
    std::optional<domain::GameAction> ResolveShortcutAction(const std::string& actionType) const;
    void UpdateInfoPanel();
    void RebuildInfoPanelChoices();
    void SelectInfoPanel(const std::string& id, bool announce);
    void UpdateStatus(const wxString& message, bool isError = false, bool announce = false);
    void PublishLogMessages(const std::vector<std::string>& messages);
    void UpdateTimerAnnouncements();
    void ClearView();
    void RebuildLines();
    [[nodiscard]] std::string NormalizeKey(const wxKeyEvent& event) const;
    [[nodiscard]] wxString BuildShortcutText() const;
    [[nodiscard]] wxString BuildHeaderText() const;
    [[nodiscard]] wxString BuildStateSummaryText() const;
    [[nodiscard]] wxString BuildPendingText() const;
    [[nodiscard]] wxString BuildLineDetail() const;
    [[nodiscard]] wxString BuildInfoText(const std::string& panelId) const;

    application::GameSessionService& service_;
    wxStaticText* headerLabel_ = nullptr;
    wxStaticText* stateSummaryLabel_ = nullptr;
    wxStaticText* pendingLabel_ = nullptr;
    wxScrolledWindow* contentPanel_ = nullptr;
    hand::GameHandPanel* handPanel_ = nullptr;
    dice::GameDicePanel* dicePanel_ = nullptr;
    grid::GameGridPanel* gridPanel_ = nullptr;
    movement::GameMovementPanel* movementPanel_ = nullptr;
    resources::GameResourcesPanel* resourcesPanel_ = nullptr;
    workflows::GameWorkflowPanel* workflowPanel_ = nullptr;
    wxStaticText* actionsLabel_ = nullptr;
    wxListBox* linesList_ = nullptr;
    wxStaticText* choicesLabel_ = nullptr;
    wxListBox* choicesList_ = nullptr;
    wxRearrangeCtrl* orderingChoices_ = nullptr;
    wxTextCtrl* infoText_ = nullptr;
    wxChoice* infoPanelChoice_ = nullptr;
    std::vector<std::string> infoPanelIds_;
    wxStaticText* shortcutsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    confirmation::GameActionConfirmationPanel* confirmationPanel_ = nullptr;
    prompt::GamePromptPanel* promptPanel_ = nullptr;
    pawn_selection::PawnSelectionPanel* pawnSelectionPanel_ = nullptr;
    domain::GameState state_;
    int roomId_ = 0;
    std::string gameType_;
    std::string gameName_;
    std::string activeInfoPanel_ = "details";
    std::string dismissedPromptActionType_;
    std::string submittedPromptActionType_;
    std::string rulesText_;
    bool roomStarted_ = true;
    bool roomStartFlowRequested_ = false;
    bool roomStartPending_ = false;
    application::GameStartConfigurationFlow startConfigurationFlow_;
    history::GameLogCursor logCursor_;
    ZoneFocusRequestedHandler onZoneFocusRequested_;
    HistoryMessageHandler onHistoryMessage_;
    TableShortcutHandler onTableShortcut_;
    GameSoundEventHandler onGameSoundEvent_;
    RoomStartRequestedHandler onRoomStartRequested_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    lila::shared::concurrency::AsyncRequestSlot inputRequestSlot_;
    application::GameCommandSubmissionGuard inputSubmissionGuard_;
    std::unordered_set<std::string> announcedTimers_;
    std::unordered_set<std::string> observedEventIdentities_;
    std::vector<std::size_t> pendingChoiceIndexes_;
};
}
