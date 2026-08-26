#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <utility>

#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
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
    if (!application::GameStateUpdatePolicy::ShouldApply(state_, state))
    {
        lila::shared::logging::LogWarning(
            "GameInput",
            "State rejected: currentVersion=" + std::to_string(state_.version) +
                ", incomingVersion=" + std::to_string(state.version) +
                ", currentStatus=" + state_.status +
                ", incomingStatus=" + state.status);
        return;
    }
    if (!gameName_.empty()) state.gameName = gameName_;
    const bool diceRolled = diceRollTracker_.Observe(state.dice, state.turnIndex);
    state.lines = application::GameActionPresentationPolicy::GenericLines(state);
    state_ = std::move(state);
    if (diceRolled && onDiceRolled_) onDiceRolled_();
    UpdateStatus(wxString{});
    PublishLogMessages(state_.logMessages);
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
    handPanel_->ApplyCards(state_.hand);
    dicePanel_->Apply(state_.dice);
    const auto ui = state_.extras.find("ui");
    if (activeInfoPanel_ == "details" && ui != state_.extras.end() && ui->is_object())
    {
        const auto defaultPanel = ui->find("defaultPanel");
        if (defaultPanel != ui->end() && defaultPanel->is_string() &&
            !defaultPanel->get<std::string>().empty())
            activeInfoPanel_ = defaultPanel->get<std::string>();
    }
    const bool hasActions = !state_.lines.empty() &&
        (!state_.pending || state_.pending->type.empty());
    actionsLabel_->Show(hasActions);
    linesList_->Show(hasActions);
    choicesList_->Clear();
    const bool hasActionableChoices = state_.pending && state_.pending->viewerActionable &&
        std::any_of(
            state_.pending->choices.begin(), state_.pending->choices.end(),
            [](const domain::GamePendingChoice& choice) { return choice.action.has_value(); });
    if (hasActionableChoices)
    {
        for (const auto& choice : state_.pending->choices)
            choicesList_->Append(FromUtf8(choice.label));
        if (choicesList_->GetCount() > 0) choicesList_->SetSelection(0);
    }
    choicesLabel_->Show(hasActionableChoices);
    choicesList_->Show(hasActionableChoices);
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
    if (!roomStarted_ && roomStartFlowRequested_ &&
        !startConfigurationFlow_.IsAwaitingActionAcknowledgement() &&
        (!state_.prompt || !state_.prompt->submitThenStart))
    {
        roomStartFlowRequested_ = false;
        roomStartPending_ = true;
        if (onRoomStartRequested_) onRoomStartRequested_();
    }
}

void GamePlayPanel::UpdateInfoPanel()
{
    infoText_->SetValue(BuildInfoText(activeInfoPanel_));
}

void GamePlayPanel::UpdateStatus(const wxString& message, bool isError, bool announce)
{
    statusLabel_->SetLabel(message);
    statusLabel_->Show(!message.empty());
    statusLabel_->SetForegroundColour(isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    if (announce)
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*statusLabel_, message);
    else
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

void GamePlayPanel::PublishLogMessages(const std::vector<std::string>& messages)
{
    const auto freshMessages = logCursor_.ExtractNew(messages);
    if (!onHistoryMessage_) return;
    for (const auto& message : freshMessages) onHistoryMessage_(FromUtf8(message));
}

void GamePlayPanel::ClearView()
{
    activeInfoPanel_ = "details";
    dismissedPromptActionType_.clear();
    submittedPromptActionType_.clear();
    confirmationPanel_->HideConfirmation();
    promptPanel_->HidePrompt(true);
    pawnSelectionPanel_->Clear();
    headerLabel_->SetLabel(wxString(L"Zone de jeu"));
    stateSummaryLabel_->SetLabel(wxString{});
    stateSummaryLabel_->Hide();
    pendingLabel_->SetLabel(wxString{});
    pendingLabel_->Hide();
    linesList_->Clear();
    choicesList_->Clear();
    choicesLabel_->Hide();
    choicesList_->Hide();
    handPanel_->ClearHand();
    dicePanel_->Clear();
    infoText_->Clear();
    logCursor_.Reset();
    diceRollTracker_.Reset();
    shortcutsLabel_->SetLabel(wxString{});
    statusLabel_->SetLabel(wxString{});
    statusLabel_->Hide();
    Layout();
}

void GamePlayPanel::RebuildLines()
{
    const int previousSelection = linesList_->GetSelection();
    linesList_->Clear();
    for (const auto& line : state_.lines)
    {
        linesList_->Append(FromUtf8(line.label));
    }
    if (!state_.lines.empty())
    {
        const int nextSelection = previousSelection != wxNOT_FOUND &&
            previousSelection >= 0 &&
            static_cast<std::size_t>(previousSelection) < state_.lines.size()
            ? previousSelection
            : 0;
        linesList_->SetSelection(nextSelection);
    }
}

wxString GamePlayPanel::BuildShortcutText() const
{
    return shortcuts::GameShortcutResolver::BuildHelpText(state_);
}

wxString GamePlayPanel::BuildLineDetail() const
{
    const int selection = linesList_->GetSelection();
    if (selection == wxNOT_FOUND || selection < 0 || static_cast<std::size_t>(selection) >= state_.lines.size())
        return wxString(L"Aucune ligne sélectionnée.");
    const auto& line = state_.lines[static_cast<std::size_t>(selection)];
    wxString text = FromUtf8(line.label);
    if (!line.detail.empty()) text += wxString(L"\n") + FromUtf8(line.detail);
    return text;
}

wxString GamePlayPanel::BuildInfoText(const std::string& panelId) const
{
    return info::GameInfoTextBuilder::Build(state_, panelId, BuildLineDetail());
}
}
