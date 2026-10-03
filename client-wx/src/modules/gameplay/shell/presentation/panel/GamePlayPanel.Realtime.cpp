#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/session/domain/GameProtocol.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::gameplay::presentation
{
namespace
{
bool RequiresStateRefreshAfterRejection(const std::string& errorCode)
{
    return errorCode == "GAME_STATE_CONFLICT" ||
        errorCode == "GAME_ACTION_REJECTED" ||
        errorCode == "GAME_TURN_VIOLATION";
}
}

void GamePlayPanel::HandleEvent(domain::GameEvent event)
{
    switch (event.type)
    {
    case domain::GameEventType::StateUpdated:
        if (event.state)
        {
            lila::shared::logging::LogInfo(
                "GameInput",
                "State received: version=" + std::to_string(event.state->version) +
                    ", status=" + std::string(domain::MatchStatusId(
                        event.state->system.match.status)) +
                    ", phase=" + event.state->system.setup.phase.value +
                    ", hand=" + std::to_string(event.state->kits.VisibleHand().size()) +
                    ", actions=" + std::to_string(event.state->actions.size()));
            ApplyState(std::move(*event.state));
        }
        return;
    case domain::GameEventType::Acknowledged:
    {
        if (!event.acknowledgement)
        {
            lila::shared::logging::LogError(
                "GameInput", "Acknowledgement payload missing.");
            return;
        }
        const auto& acknowledgement = *event.acknowledgement;
        const bool acknowledgedAction = acknowledgement.command == protocol::Action;
        lila::shared::logging::LogInfo(
            "GameInput", "Acknowledgement received: " + acknowledgement.command);
        const bool matchesPendingCommand = inputSubmissionGuard_.Acknowledge(
            acknowledgement.command,
            !acknowledgement.ok || !acknowledgedAction,
            acknowledgement.commandId);
        if (acknowledgedAction && !matchesPendingCommand)
        {
            lila::shared::logging::LogWarning(
                "GameInput", "Stale action acknowledgement ignored.");
            RequestRefresh();
            return;
        }
        retryableActionCommand_.reset();
        if (!acknowledgement.ok)
        {
            if (!acknowledgement.message.empty())
            {
                UpdateStatus(FromUtf8(acknowledgement.message), true, true);
                if (onHistoryMessage_)
                    onHistoryMessage_(FromUtf8(acknowledgement.message), false);
            }
            submittedPromptActionType_.clear();
            SyncInlinePrompt();
            startConfigurationFlow_.Reset();
            // A negative acknowledgement can arrive after the server has
            // advanced the game without emitting a state event to this
            // client. Always recover its authoritative projection instead of
            // leaving the rejected action visible and trapping the player.
            if (acknowledgement.command == protocol::Action ||
                acknowledgement.command == protocol::Key)
                RequestRefresh();
            return;
        }
        if (startConfigurationFlow_.Acknowledge(acknowledgement.command))
        {
            submittedPromptActionType_.clear();
            // A successful acknowledgement proves that the configuration was
            // committed. Do not make room start depend on the following state
            // notification: it can arrive late or be lost independently and
            // would otherwise leave the start flow stuck after validation.
            if (!lifecycle_.IsRoomStarted() && lifecycle_.IsStartFlowRequested())
            {
                lifecycle_.MarkRoomStartPending();
                if (onRoomStartRequested_) onRoomStartRequested_();
            }
            // Refresh independently so the first interaction is available as
            // soon as the room-start notification activates the game panel.
            RequestRefresh();
            return;
        }
        const bool openedPanel = !acknowledgement.panelId.empty() &&
            HandleInterfaceShortcut(acknowledgement.panelId);
        if (!acknowledgement.message.empty())
        {
            UpdateStatus(FromUtf8(acknowledgement.message), false, true);
            if (!openedPanel && onHistoryMessage_)
                onHistoryMessage_(FromUtf8(acknowledgement.message), false);
        }
        if (acknowledgement.roomOperation == "start" ||
            acknowledgement.roomOperation == "reset")
            RequestRefresh();
        // State notifications and acknowledgements travel independently. A
        // refresh after every accepted gameplay command repairs a lost or
        // reordered realtime notification before the player can act again.
        if (acknowledgedAction || acknowledgement.command == protocol::Key)
            RequestRefresh();
        return;
    }
    case domain::GameEventType::TurnUpdated:
    {
        if (lifecycle_.IsRoomStarted() &&
            domain::IsActive(state_.system.match.status) &&
            !event.message.empty() && onHistoryMessage_)
            onHistoryMessage_(FromUtf8(event.message), false);
        if (lifecycle_.IsRoomStarted() && lifecycle_.HasAuthoritativeState()) RequestRefresh();
        return;
    }
    case domain::GameEventType::ActionCandidates:
        if (event.candidates && event.candidates->roomId == roomId_ &&
            event.candidates->gameType == gameType_)
            promptPanel_->ApplyCandidates(*event.candidates);
        return;
    case domain::GameEventType::Rules:
        rulesText_ = std::move(event.rules);
        if (onHistoryMessage_) onHistoryMessage_(FromUtf8(rulesText_), false);
        return;
    case domain::GameEventType::ConnectionStatus:
        if (event.connectionState == domain::GameConnectionState::Reconnecting)
            lifecycle_.MarkReconnecting();
        else if (event.connectionState == domain::GameConnectionState::Connected)
            lifecycle_.MarkConnected();
        Show(lifecycle_.IsVisible());
        SyncContentVisibility();
        UpdateStatus(FromUtf8(event.message), event.isError, true);
        if (event.connectionState == domain::GameConnectionState::Connected)
            RequestRefresh();
        return;
    case domain::GameEventType::Error:
        inputSubmissionGuard_.Reset();
        promptPanel_->RejectCandidatesRequest();
        if (!event.errorCode.empty()) retryableActionCommand_.reset();
        lila::shared::logging::LogError("GameInput", "Server error: " + event.message);
        UpdateStatus(FromUtf8(event.message), true, true);
        if (onHistoryMessage_ && !event.message.empty())
            onHistoryMessage_(FromUtf8(event.message), false);
        if (RequiresStateRefreshAfterRejection(event.errorCode))
        {
            submittedPromptActionType_.clear();
            RequestRefresh();
        }
        if (startConfigurationFlow_.IsAwaitingActionAcknowledgement())
        {
            startConfigurationFlow_.Reset();
            submittedPromptActionType_.clear();
            SyncInlinePrompt();
        }
        return;
    case domain::GameEventType::Ignored:
        return;
    }
}
}
