#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <wx/choice.h>
#include <wx/listbox.h>
#include <wx/rearrangectrl.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/information/presentation/GameInfoTextBuilder.h"
#include "modules/gameplay/movement/presentation/GameMovementPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/resources/presentation/GameResourcesPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::UpdateInfoPanel()
{
    infoText_->SetValue(BuildInfoText(activeInfoPanel_));
}

void GamePlayPanel::UpdateStatus(const wxString& message, bool isError, bool announce)
{
    statusLabel_->SetLabel(message);
    statusLabel_->Show(!message.empty());
    statusLabel_->SetForegroundColour(isError
        ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
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
    for (const auto& message : freshMessages)
    {
        const auto separator = message.find('|');
        onHistoryMessage_(FromUtf8(separator == std::string::npos
            ? message : message.substr(separator + 1)));
    }
}

void GamePlayPanel::ClearView()
{
    activeInfoPanel_ = "details";
    dismissedPromptActionType_.clear();
    submittedPromptActionType_.clear();
    rulesText_.clear();
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
    orderingChoices_->GetList()->Clear();
    pendingChoiceIndexes_.clear();
    pendingChoiceSignatures_.clear();
    pendingChoiceValues_.clear();
    renderedPendingOrdering_ = false;
    choicesLabel_->Hide();
    choicesList_->Hide();
    orderingChoices_->Hide();
    handPanel_->ClearHand();
    dicePanel_->Clear();
    gridPanel_->Clear();
    movementPanel_->Clear();
    resourcesPanel_->Clear();
    workflowPanel_->Clear();
    renderedLineIds_.clear();
    infoText_->Clear();
    infoPanelChoice_->Clear();
    infoPanelIds_.clear();
    logCursor_.Reset();
    observedEventIdentities_.clear();
    announcedTimers_.clear();
    shortcutsLabel_->SetLabel(wxString{});
    statusLabel_->SetLabel(wxString{});
    statusLabel_->Hide();
    Layout();
}

void GamePlayPanel::RebuildLines()
{
    std::vector<std::string> nextIds;
    nextIds.reserve(lines_.size());
    for (const auto& line : lines_) nextIds.push_back(line.id);
    if (linesList_->GetCount() == lines_.size() && nextIds == renderedLineIds_)
    {
        bool unchanged = true;
        for (std::size_t index = 0; index < lines_.size(); ++index)
            if (linesList_->GetString(static_cast<unsigned int>(index)) !=
                FromUtf8(lines_[index].label))
            {
                unchanged = false;
                break;
            }
        if (unchanged) return;
    }
    const int previousSelection = linesList_->GetSelection();
    const auto previousId = previousSelection >= 0 &&
        static_cast<std::size_t>(previousSelection) < renderedLineIds_.size()
        ? renderedLineIds_[static_cast<std::size_t>(previousSelection)] : std::string{};
    linesList_->Clear();
    renderedLineIds_ = std::move(nextIds);
    for (const auto& line : lines_) linesList_->Append(FromUtf8(line.label));
    if (lines_.empty()) return;
    const auto restored = std::find(
        renderedLineIds_.begin(), renderedLineIds_.end(), previousId);
    const int nextSelection = restored == renderedLineIds_.end()
        ? 0 : static_cast<int>(std::distance(renderedLineIds_.begin(), restored));
    linesList_->SetSelection(nextSelection);
}

wxString GamePlayPanel::BuildShortcutText() const
{
    return shortcuts::GameShortcutResolver::BuildHelpText(state_);
}

wxString GamePlayPanel::BuildLineDetail() const
{
    const int selection = linesList_->GetSelection();
    if (selection == wxNOT_FOUND || selection < 0 ||
        static_cast<std::size_t>(selection) >= lines_.size())
        return wxString(L"Aucune ligne sélectionnée.");
    const auto& line = lines_[static_cast<std::size_t>(selection)];
    wxString text = FromUtf8(line.label);
    if (!line.detail.empty()) text += wxString(L"\n") + FromUtf8(line.detail);
    return text;
}

wxString GamePlayPanel::BuildInfoText(const std::string& panelId) const
{
    if (panelId == "rules") return rulesText_.empty()
        ? wxString(L"Chargement des règles...") : FromUtf8(rulesText_);
    return info::GameInfoTextBuilder::Build(state_, panelId, BuildLineDetail());
}
}
