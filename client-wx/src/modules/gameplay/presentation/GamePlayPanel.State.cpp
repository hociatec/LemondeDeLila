#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <utility>

#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/GamePlayFormatters.h"
#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/hand/GameHandPanel.h"
#include "modules/gameplay/presentation/info/GameInfoTextBuilder.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"
#include "modules/gameplay/presentation/shortcuts/GameShortcutResolver.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::ApplyState(domain::GameState state)
{
    if (!gameName_.empty()) state.gameName = gameName_;
    state_ = std::move(state);
    headerLabel_->SetLabel(BuildHeaderText());
    RebuildLines();
    handPanel_->ApplyExtras(state_.extras);
    AppendLogMessages(state_.logMessages);
    shortcutsLabel_->SetLabel(BuildShortcutText());
    UpdateInfoPanel();
    SyncInlinePrompt();
    Layout();
}

void GamePlayPanel::UpdateInfoPanel()
{
    infoText_->SetValue(BuildInfoText(activeInfoPanel_));
}

void GamePlayPanel::UpdateStatus(const wxString& message, bool isError, bool announce)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    if (announce)
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*statusLabel_, message);
    else
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

void GamePlayPanel::AppendLogMessages(const std::vector<std::string>& messages)
{
    logText_->Clear();
    for (const auto& message : messages)
    {
        if (!logText_->IsEmpty()) logText_->AppendText(wxString(L"\n"));
        logText_->AppendText(FromUtf8(message));
    }
}

void GamePlayPanel::ClearView()
{
    confirmationPanel_->HideConfirmation();
    promptPanel_->HidePrompt(true);
    headerLabel_->SetLabel(wxString(L"Zone de jeu"));
    linesList_->Clear();
    handPanel_->ClearHand();
    infoText_->Clear();
    logText_->Clear();
    shortcutsLabel_->SetLabel(wxString{});
    statusLabel_->SetLabel(wxString{});
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
        lila::shared::accessibility::NavigationController::Focus(linesList_);
    }
}

wxString GamePlayPanel::BuildShortcutText() const
{
    return shortcuts::GameShortcutResolver::BuildHelpText(state_);
}

wxString GamePlayPanel::BuildHeaderText() const
{
    wxString text = FromUtf8(state_.gameName.empty() ? gameName_ : state_.gameName);
    if (!state_.phase.empty()) text += wxString(L" - ") + FromUtf8(state_.phase);
    if (!state_.currentPlayerLabel.empty()) text += wxString(L" - ") + FromUtf8(state_.currentPlayerLabel);
    if (!state_.turnLabel.empty()) text += wxString(L" - ") + FromUtf8(state_.turnLabel);
    return text;
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
