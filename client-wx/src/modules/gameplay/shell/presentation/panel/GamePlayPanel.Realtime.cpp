#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::HandleEvent(domain::GameEvent event)
{
    switch (event.type)
    {
    case domain::GameEventType::StateUpdated:
        if (event.state)
        {
            retryableActionCommand_.reset();
            inputSubmissionGuard_.ObserveState(
                event.state->version, event.state->runId);
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
        lila::shared::logging::LogInfo(
            "GameInput", "Acknowledgement received: " + acknowledgement.command);
        static_cast<void>(inputSubmissionGuard_.Acknowledge(
            acknowledgement.command));
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
            return;
        }
        if (startConfigurationFlow_.Acknowledge(acknowledgement.command))
        {
            submittedPromptActionType_.clear();
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
        return;
    }
    case domain::GameEventType::TurnUpdated:
    {
        if (roomStarted_ && state_.system.match.status == "started" &&
            !event.message.empty() && onHistoryMessage_)
            onHistoryMessage_(FromUtf8(event.message), false);
        return;
    }
    case domain::GameEventType::ActionCandidates:
        if (event.candidates && event.candidates->roomId == roomId_ &&
            event.candidates->gameType == gameType_)
            promptPanel_->ApplyCandidates(*event.candidates);
        return;
    case domain::GameEventType::Rules:
        rulesText_ = std::move(event.rules);
        activeInfoPanel_ = "rules";
        UpdateInfoPanel();
        if (onHistoryMessage_) onHistoryMessage_(BuildInfoText("rules"), false);
        return;
    case domain::GameEventType::Error:
        inputSubmissionGuard_.Reset();
        promptPanel_->RejectCandidatesRequest();
        if (!event.errorCode.empty()) retryableActionCommand_.reset();
        lila::shared::logging::LogError("GameInput", "Server error: " + event.message);
        UpdateStatus(FromUtf8(event.message), true, true);
        if (onHistoryMessage_ && !event.message.empty())
            onHistoryMessage_(FromUtf8(event.message), false);
        if (event.errorCode == "GAME_STATE_CONFLICT")
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
