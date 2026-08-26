#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
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
            inputSubmissionGuard_.ObserveState(
                event.state->version, event.state->runId);
            lila::shared::logging::LogInfo(
                "GameInput",
                "State received: version=" + std::to_string(event.state->version) +
                    ", status=" + event.state->status +
                    ", phase=" + event.state->phase +
                    ", hand=" + std::to_string(event.state->hand.size()) +
                    ", actions=" + std::to_string(event.state->actions.size()));
            ApplyState(std::move(*event.state));
        }
        return;
    case domain::GameEventType::Acknowledged:
    {
        domain::GameAcknowledgement fallback;
        fallback.command = event.message;
        fallback.ok = true;
        const auto acknowledgement = event.acknowledgement.value_or(fallback);
        lila::shared::logging::LogInfo(
            "GameInput", "Acknowledgement received: " + acknowledgement.command);
        static_cast<void>(inputSubmissionGuard_.Acknowledge(
            acknowledgement.command));
        if (!acknowledgement.ok)
        {
            const auto message = acknowledgement.message.empty()
                ? std::string("Action indisponible.")
                : acknowledgement.message;
            UpdateStatus(FromUtf8(message), true, true);
            if (onHistoryMessage_) onHistoryMessage_(FromUtf8(message));
            pawnSelectionPanel_->AllowRetry();
            submittedPromptActionType_.clear();
            SyncInlinePrompt();
            startConfigurationFlow_.Reset();
            return;
        }
        if (startConfigurationFlow_.Acknowledge(acknowledgement.command))
        {
            roomStartFlowRequested_ = false;
            roomStartPending_ = true;
            submittedPromptActionType_.clear();
            if (onRoomStartRequested_) onRoomStartRequested_();
            if (onZoneFocusRequested_) onZoneFocusRequested_();
            return;
        }
        const bool openedPanel = !acknowledgement.panelId.empty() &&
            HandleInterfaceShortcut(acknowledgement.panelId);
        if (!acknowledgement.message.empty())
        {
            UpdateStatus(FromUtf8(acknowledgement.message), false, true);
            if (!openedPanel && onHistoryMessage_)
                onHistoryMessage_(FromUtf8(acknowledgement.message));
        }
        if (acknowledgement.roomOperation == "start" ||
            acknowledgement.roomOperation == "reset")
            RequestRefresh();
        return;
    }
    case domain::GameEventType::TurnUpdated:
    {
        const auto message = event.message.empty()
            ? wxString(L"Tour inconnu.")
            : wxString(L"C'est au tour de ") + FromUtf8(event.message) + wxString(L".");
        if (onHistoryMessage_) onHistoryMessage_(message);
        return;
    }
    case domain::GameEventType::Error:
        inputSubmissionGuard_.Reset();
        lila::shared::logging::LogError("GameInput", "Server error: " + event.message);
        UpdateStatus(FromUtf8(event.message), true, true);
        if (onHistoryMessage_ && !event.message.empty())
            onHistoryMessage_(wxString(L"Erreur : ") + FromUtf8(event.message));
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
