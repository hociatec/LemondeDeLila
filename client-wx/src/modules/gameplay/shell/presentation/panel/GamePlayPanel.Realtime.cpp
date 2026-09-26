#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
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
                    ", status=" + event.state->system.match.status +
                    ", phase=" + event.state->system.setup.phase +
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
        retryableActionCommand_.reset();
        const bool acknowledgedAction = acknowledgement.command == "game.action";
        lila::shared::logging::LogInfo(
            "GameInput", "Acknowledgement received: " + acknowledgement.command);
        static_cast<void>(inputSubmissionGuard_.Acknowledge(
            acknowledgement.command,
            !acknowledgement.ok || !acknowledgedAction));
        if (!acknowledgement.ok)
        {
            if (!acknowledgement.message.empty())
            {
                UpdateStatus(FromUtf8(acknowledgement.message), true, true);
                if (onHistoryMessage_)
                    onHistoryMessage_(FromUtf8(acknowledgement.message), false);
            }
            pawnSelectionPanel_->AllowRetry();
            submittedPromptActionType_.clear();
            SyncInlinePrompt();
            startConfigurationFlow_.Reset();
            // A negative acknowledgement can arrive after the server has
            // advanced the game without emitting a state event to this
            // client. Always recover its authoritative projection instead of
            // leaving the rejected action visible and trapping the player.
            if (acknowledgement.command == "game.action" ||
                acknowledgement.command == "game.key")
                RequestRefresh();
            return;
        }
        if (startConfigurationFlow_.Acknowledge(acknowledgement.command))
        {
            submittedPromptActionType_.clear();
            // Configuration acknowledgements may arrive without the following
            // state notification. Fetch it explicitly so the first quiz
            // question is displayed and the room-start flow can continue.
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
        if (acknowledgedAction || acknowledgement.command == "game.key")
            RequestRefresh();
        return;
    }
    case domain::GameEventType::TurnUpdated:
    {
        if (roomStarted_ &&
            (state_.system.match.status == "started" ||
             state_.system.match.status == "playing") &&
            !event.message.empty() && onHistoryMessage_)
            onHistoryMessage_(FromUtf8(event.message), false);
        if (roomStarted_ && hasAuthoritativeState_) RequestRefresh();
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
        UpdateStatus(FromUtf8(event.message), event.isError, true);
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
            pawnSelectionPanel_->AllowRetry();
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
