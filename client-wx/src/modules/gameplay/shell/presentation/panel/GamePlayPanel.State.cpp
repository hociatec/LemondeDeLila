#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include <algorithm>
#include <utility>
#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/choice.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/movement/presentation/GameMovementPanel.h"
#include "modules/gameplay/resources/presentation/GameResourcesPanel.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
#include "modules/gameplay/information/presentation/GameInfoTextBuilder.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "modules/gameplay/state/application/GameStateUpdatePolicy.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/theme/Theme.h"
namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::ApplyState(domain::GameState state)
{
    const bool hadNavigationTarget = PreferredNavigationTarget() != nullptr;
    std::optional<domain::GameValue> previousPendingChoice;
    std::vector<domain::GameValue> previousPendingOrder;
    if (state_.pending && choicesList_->GetSelection() != wxNOT_FOUND)
    {
        const int selected = choicesList_->GetSelection();
        if (selected >= 0 && static_cast<std::size_t>(selected) < state_.pending->choices.size())
            previousPendingChoice = state_.pending->choices[static_cast<std::size_t>(selected)].value;
    }
    if (state_.pending && state_.pending->ordering && orderingChoices_->IsShown())
        for (const int encodedIndex : orderingChoices_->GetList()->GetCurrentOrder())
        {
            const int displayIndex = encodedIndex < 0 ? ~encodedIndex : encodedIndex;
            if (displayIndex < 0 ||
                static_cast<std::size_t>(displayIndex) >= pendingChoiceIndexes_.size()) continue;
            const auto stateIndex = pendingChoiceIndexes_[static_cast<std::size_t>(displayIndex)];
            if (stateIndex < state_.pending->choices.size())
                previousPendingOrder.push_back(state_.pending->choices[stateIndex].value);
        }
    const bool initialState = state_.viewVersion == 0;
    const auto previousTurnPlayer = state_.system.turn.currentPlayerId;
    const auto previousRoundWinners = state_.system.round.winnerPlayerIds;
    const bool wasFinished = state_.system.match.status == "finished";
    if (!application::GameStateUpdatePolicy::ShouldApply(state_, state))
    {
        lila::shared::logging::LogWarning(
            "GameInput",
            "State rejected: currentVersion=" + std::to_string(state_.version) +
                ", incomingVersion=" + std::to_string(state.version) +
                ", currentStatus=" + state_.system.match.status +
                ", incomingStatus=" + state.system.match.status);
        return;
    }
    state.lines = application::GameActionPresentationPolicy::GenericLines(state);
    state_ = std::move(state);
    RebuildInfoPanelChoices();
    UpdateTimerAnnouncements();
    if (initialState)
        for (const auto& event : state_.system.events)
            observedEventIdentities_.insert(event.Identity());
    else if (onGameSoundEvent_)
    {
        for (const auto& event : state_.system.events)
            if (observedEventIdentities_.insert(event.Identity()).second)
                onGameSoundEvent_(event.type,
                    state_.system.match.result
                        ? state_.system.match.result->winnerPlayerIds : std::vector<int>{});
    }
    UpdateStatus(wxString{});
    if (initialState)
    {
        logCursor_.Restore(state_.logMessages);
        if (onHistoryMessage_)
            onHistoryMessage_(FromUtf8(TurnLabel(state_)));
    }
    else PublishLogMessages(state_.logMessages);
    if (!initialState && previousTurnPlayer != state_.system.turn.currentPlayerId &&
        onHistoryMessage_)
        onHistoryMessage_(FromUtf8(TurnLabel(state_)));
    if (!initialState && previousRoundWinners != state_.system.round.winnerPlayerIds &&
        !state_.system.round.winnerPlayerIds.empty() && onHistoryMessage_)
    {
        wxString message(L"Manche terminée. Gagnant(s) : ");
        for (std::size_t index = 0; index < state_.system.round.winnerPlayerIds.size(); ++index)
        {
            if (index > 0) message += wxString(L", ");
            const int id = state_.system.round.winnerPlayerIds[index];
            const auto player = std::find_if(state_.system.players.begin(), state_.system.players.end(),
                [id](const domain::GamePlayer& value) { return value.id == id; });
            message += player == state_.system.players.end()
                ? wxString::Format(L"Joueur %d", id) : FromUtf8(player->username);
        }
        onHistoryMessage_(message);
    }
    if (!initialState && !wasFinished && state_.system.match.status == "finished" &&
        state_.system.match.result && onHistoryMessage_)
    {
        wxString message(L"Partie terminée. Gagnant(s) : ");
        for (std::size_t index = 0; index < state_.system.match.result->winnerPlayerIds.size(); ++index)
        {
            if (index > 0) message += wxString(L", ");
            const int id = state_.system.match.result->winnerPlayerIds[index];
            const auto player = std::find_if(state_.system.players.begin(), state_.system.players.end(),
                [id](const domain::GamePlayer& value) { return value.id == id; });
            message += player == state_.system.players.end()
                ? wxString::Format(L"Joueur %d", id) : FromUtf8(player->username);
        }
        onHistoryMessage_(message);
    }
    if (IsFinished())
    {
        confirmationPanel_->HideConfirmation();
        promptPanel_->HidePrompt(true);
        pawnSelectionPanel_->Clear();
    }
    Show(roomStarted_ || roomStartFlowRequested_ || roomStartPending_);
    headerLabel_->SetLabel(BuildHeaderText());
    stateSummaryLabel_->SetLabel(BuildStateSummaryText());
    stateSummaryLabel_->Show(!stateSummaryLabel_->GetLabel().empty());
    pendingLabel_->SetLabel(BuildPendingText());
    pendingLabel_->Show(!pendingLabel_->GetLabel().empty());
    RebuildLines();
    handPanel_->ApplyCards(state_.kits.VisibleHand());
    dicePanel_->Apply(state_.kits.dice);
    gridPanel_->Apply(state_.kits.grid ? &*state_.kits.grid : nullptr,
        state_.actions, state_.system.players,
        state_.kits.pawns ? &*state_.kits.pawns : nullptr);
    movementPanel_->Apply(state_.kits, state_.system.players);
    resourcesPanel_->Apply(state_);
    workflowPanel_->Apply(state_);
    const bool hasActions = !state_.lines.empty() &&
        (!state_.pending || state_.pending->type.empty());
    actionsLabel_->Show(hasActions);
    linesList_->Show(hasActions);
    choicesList_->Clear();
    orderingChoices_->GetList()->Clear();
    pendingChoiceIndexes_.clear();
    const bool hasActionableChoices = state_.pending && state_.pending->viewerActionable &&
        (state_.pending->selectionAction || std::any_of(
            state_.pending->choices.begin(), state_.pending->choices.end(),
            [](const domain::GamePendingChoice& choice) { return choice.action.has_value(); }));
    if (hasActionableChoices)
    {
        if (state_.pending->ordering)
        {
            std::vector<bool> inserted(state_.pending->choices.size(), false);
            for (const auto& previous : previousPendingOrder)
                for (std::size_t index = 0; index < state_.pending->choices.size(); ++index)
                    if (!inserted[index] && state_.pending->choices[index].value == previous)
                    {
                        pendingChoiceIndexes_.push_back(index);
                        inserted[index] = true;
                        break;
                    }
            for (std::size_t index = 0; index < state_.pending->choices.size(); ++index)
                if (!inserted[index]) pendingChoiceIndexes_.push_back(index);
            for (const auto index : pendingChoiceIndexes_)
                orderingChoices_->GetList()->Append(FromUtf8(state_.pending->choices[index].label));
        }
        else
        {
            for (const auto& choice : state_.pending->choices)
                choicesList_->Append(FromUtf8(choice.label));
            int selection = 0;
            if (previousPendingChoice)
                for (std::size_t index = 0; index < state_.pending->choices.size(); ++index)
                    if (state_.pending->choices[index].value == *previousPendingChoice)
                    {
                        selection = static_cast<int>(index);
                        break;
                    }
            if (choicesList_->GetCount() > 0) choicesList_->SetSelection(selection);
        }
    }
    choicesLabel_->Show(hasActionableChoices);
    choicesList_->Show(hasActionableChoices && !state_.pending->ordering);
    orderingChoices_->Show(hasActionableChoices && state_.pending->ordering);
    shortcutsLabel_->SetLabel(BuildShortcutText());
    shortcutsLabel_->Show(!shortcutsLabel_->GetLabel().empty());
    UpdateInfoPanel();
    infoText_->Show(!infoText_->GetValue().empty());
    SyncInlinePrompt();
    const bool pawnSelectionCompleted =
        pawnSelectionPanel_->IsActive() && !state_.pawnSelection.has_value();
    pawnSelectionPanel_->Apply(state_.pawnSelection);
    if (pawnSelectionCompleted && onZoneFocusRequested_) onZoneFocusRequested_();
    SyncContentVisibility();
    Layout();
    if (GetParent()) GetParent()->Layout();
    if (!hadNavigationTarget && PreferredNavigationTarget() != nullptr &&
        onZoneFocusRequested_)
        onZoneFocusRequested_();
    const bool setupProjectionCompleted = startConfigurationFlow_.ObserveSetup(
        state_.system.setup);
    if (!roomStarted_ && roomStartFlowRequested_ &&
        !startConfigurationFlow_.IsAwaitingActionAcknowledgement() &&
        state_.system.setup.complete &&
        (setupProjectionCompleted || !state_.prompt))
    {
        roomStartFlowRequested_ = false;
        roomStartPending_ = true;
        if (onRoomStartRequested_) onRoomStartRequested_();
    }
}
}
