#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include <algorithm>
#include <utility>
#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/choice.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/events/presentation/GameEventPresenter.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/movement/presentation/GameMovementPanel.h"
#include "modules/gameplay/resources/presentation/GameResourcesPanel.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
#include "modules/gameplay/information/presentation/GameInfoTextBuilder.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "modules/gameplay/state/application/GameStateUpdatePolicy.h"
#include "modules/gameplay/state/application/GamePendingSelectionPolicy.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/theme/Theme.h"
namespace lila::modules::gameplay::presentation
{
namespace
{
std::vector<std::string> EventMessages(const domain::GameState& state)
{
    std::vector<std::string> messages;
    messages.reserve(state.system.events.size());
    for (const auto& event : state.system.events)
    {
        const auto message = events::GameEventPresenter::Present(
            event, state.system.players);
        if (!message.empty()) messages.push_back(event.Identity() + "|" + message);
    }
    return messages;
}
}

void GamePlayPanel::ApplyState(domain::GameState state)
{
    const wxWeakRef<wxWindow> focusedBefore(wxWindow::FindFocus());
    const bool hadVisibleHand = !state_.kits.VisibleHand().empty();
    const bool receivesVisibleHand = !state.kits.VisibleHand().empty();
    const bool focusWasInsideGame =
        lila::shared::accessibility::NavigationController::IsDescendantOf(
            focusedBefore.get(), this);
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
    auto nextLines = application::GameActionPresentationPolicy::GenericLines(state);
    auto nextPawnSelection = infrastructure::PawnSelectionDecoder::Decode(state.pending);
    auto nextLogMessages = EventMessages(state);
    state_ = std::move(state);
    lines_ = std::move(nextLines);
    pawnSelection_ = std::move(nextPawnSelection);
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
    if (initialState) logCursor_.Restore(nextLogMessages);
    else PublishLogMessages(nextLogMessages);
    if (IsFinished())
    {
        confirmationPanel_->HideConfirmation();
        promptPanel_->HidePrompt(true);
        pawnSelectionPanel_->Clear();
        Hide();
        if (GetParent()) GetParent()->Layout();
        if (focusWasInsideGame && onZoneFocusRequested_) onZoneFocusRequested_();
        return;
    }
    Show(roomStarted_ || roomStartFlowRequested_ || roomStartPending_);
    headerLabel_->SetLabel(BuildHeaderText());
    stateSummaryLabel_->SetLabel(BuildStateSummaryText());
    stateSummaryLabel_->Show(!stateSummaryLabel_->GetLabel().empty());
    pendingLabel_->SetLabel(BuildPendingText());
    pendingLabel_->Show(!pendingLabel_->GetLabel().empty());
    RebuildLines();
    handPanel_->ApplyCards(state_.kits.VisibleHand(), state_.actions);
    gridPanel_->Apply(state_.kits.grid ? &*state_.kits.grid : nullptr,
        state_.actions, state_.system.players,
        state_.kits.pawns ? &*state_.kits.pawns : nullptr);
    movementPanel_->Apply(state_.kits, state_.system.players);
    resourcesPanel_->Apply(state_);
    workflowPanel_->Apply(state_);
    actionsLabel_->Hide();
    linesList_->Hide();
    const bool hasActionableChoices = state_.pending &&
        application::GamePendingSelectionPolicy::HasActionableChoices(*state_.pending);
    std::vector<std::string> nextPendingSignatures;
    std::vector<domain::GameValue> nextPendingValues;
    const bool pendingOrdering = hasActionableChoices && state_.pending->ordering;
    if (hasActionableChoices)
        for (const auto& choice : state_.pending->choices)
        {
            std::string signature = choice.label;
            if (choice.action)
                signature += "\n" + choice.action->type + "\n" + choice.action->payload.dump();
            nextPendingSignatures.push_back(std::move(signature));
            nextPendingValues.push_back(choice.value);
        }
    const bool pendingControlsChanged =
        nextPendingSignatures != pendingChoiceSignatures_ ||
        nextPendingValues != pendingChoiceValues_ ||
        pendingOrdering != renderedPendingOrdering_;
    if (pendingControlsChanged)
    {
        choicesList_->Clear();
        orderingChoices_->GetList()->Clear();
        pendingChoiceIndexes_.clear();
        pendingChoiceSignatures_ = std::move(nextPendingSignatures);
        pendingChoiceValues_ = std::move(nextPendingValues);
        renderedPendingOrdering_ = pendingOrdering;
        if (pendingOrdering)
        {
            pendingChoiceIndexes_ = application::GamePendingSelectionPolicy::RestoreOrder(
                state_.pending->choices, previousPendingOrder);
            for (const auto index : pendingChoiceIndexes_)
                orderingChoices_->GetList()->Append(FromUtf8(state_.pending->choices[index].label));
        }
        else if (hasActionableChoices)
        {
            for (const auto& choice : state_.pending->choices)
                choicesList_->Append(FromUtf8(choice.label));
            const int selection = static_cast<int>(
                application::GamePendingSelectionPolicy::RestoreChoiceIndex(
                    state_.pending->choices, previousPendingChoice));
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
        pawnSelectionPanel_->IsActive() && !pawnSelection_.has_value();
    pawnSelectionPanel_->Apply(pawnSelection_);
    if (pawnSelectionCompleted && onZoneFocusRequested_) onZoneFocusRequested_();
    SyncContentVisibility();
    Layout();
    if (GetParent()) GetParent()->Layout();
    const bool focusPreserved = focusedBefore && focusedBefore->IsShownOnScreen() &&
        focusedBefore->IsEnabled() && focusedBefore->AcceptsFocus();
    if (!focusPreserved && focusWasInsideGame)
    {
        auto* target = PreferredNavigationTarget();
        if (target != nullptr)
            static_cast<void>(
                lila::shared::accessibility::NavigationController::Focus(target));
        else if (onZoneFocusRequested_)
            onZoneFocusRequested_();
    }
    if (!hadVisibleHand && receivesVisibleHand && onZoneFocusRequested_)
        onZoneFocusRequested_();
    const bool setupProjectionCompleted = startConfigurationFlow_.ObserveSetup(
        state_.system.setup);
    if (!roomStarted_ && roomStartFlowRequested_ &&
        !startConfigurationFlow_.IsAwaitingActionAcknowledgement() &&
        state_.system.setup.complete &&
        (setupProjectionCompleted || ActivePrompt() == nullptr))
    {
        roomStartFlowRequested_ = false;
        roomStartPending_ = true;
        if (onRoomStartRequested_) onRoomStartRequested_();
    }
}
}
