#include "modules/gameplay/presentation/panel/GamePlayPanel.h"

#include <utility>

#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/hand/GameHandPanel.h"
#include "modules/gameplay/presentation/info/GameInfoTextBuilder.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"
#include "modules/gameplay/presentation/shortcuts/GameShortcutResolver.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::ApplyState(domain::GameState state)
{
    if (!gameName_.empty()) state.gameName = gameName_;
    state_ = std::move(state);
    UpdateStatus(wxString{});
    headerLabel_->SetLabel(BuildHeaderText());
    RebuildLines();
    handPanel_->ApplyExtras(state_.extras);
    const bool hasHand = handPanel_->Count() > 0;
    infoText_->Show(!hasHand);
    actionsLabel_->Show(!hasHand);
    linesList_->Show(!hasHand);
    shortcutsLabel_->Show(!hasHand);
    PublishLogMessages(state_.logMessages);
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
    dismissedPromptActionType_.clear();
    confirmationPanel_->HideConfirmation();
    promptPanel_->HidePrompt(true);
    headerLabel_->SetLabel(wxString(L"Zone de jeu"));
    linesList_->Clear();
    handPanel_->ClearHand();
    infoText_->Clear();
    logCursor_.Reset();
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

wxString GamePlayPanel::BuildHeaderText() const
{
    wxString text;
    const auto append = [&text](const std::string& value)
    {
        if (value.empty()) return;
        if (!text.empty()) text += wxString(L" - ");
        text += FromUtf8(value);
    };
    append(state_.phase);
    append(state_.currentPlayerLabel);
    append(state_.turnLabel);
    if (text.empty()) text = wxString(L"Partie");
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
