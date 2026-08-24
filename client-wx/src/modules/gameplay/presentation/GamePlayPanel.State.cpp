#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <sstream>
#include <utility>

#include <nlohmann/json.hpp>
#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/GamePlayFormatters.h"
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
    AppendLogMessages(state_.logMessages);
    shortcutsLabel_->SetLabel(BuildShortcutText());
    UpdateInfoPanel();
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
    headerLabel_->SetLabel(wxString(L"Zone de jeu"));
    linesList_->Clear();
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
    wxString result;
    for (const auto& shortcut : state_.shortcuts)
    {
        if (!result.empty()) result += wxString(L" | ");
        result += FromUtf8(shortcut.normalizedKey);
        if (shortcut.kind == domain::GameShortcutKind::Interface)
            result += wxString(L" ") + FromUtf8(shortcut.id);
        else if (shortcut.kind == domain::GameShortcutKind::Action)
            result += wxString(L" ") + FromUtf8(shortcut.actionType);
    }
    return result;
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
    if (panelId == "details")
    {
        wxString text;
        if (state_.prompt)
        {
            const auto& label = state_.prompt->label.empty() ? state_.prompt->title : state_.prompt->label;
            if (!label.empty()) text = FromUtf8(label) + wxString(L"\n");
        }
        return text + BuildLineDetail();
    }
    std::ostringstream out;
    const auto ui = state_.extras.find("ui");
    if (ui != state_.extras.end() && ui->is_object())
    {
        const auto uiPanels = ui->find("panels");
        if (uiPanels != ui->end() && uiPanels->is_object())
        {
            const auto panel = uiPanels->find(panelId);
            if (panel != uiPanels->end()) return FromUtf8(PanelJsonToDisplay(*panel));
        }
    }
    const auto panels = state_.extras.find("panels");
    if (panels != state_.extras.end() && panels->is_object())
    {
        const auto panel = panels->find(panelId);
        if (panel != panels->end()) return FromUtf8(PanelJsonToDisplay(*panel));
    }
    out << panelId << "\n";
    const auto direct = state_.extras.find(panelId);
    if (direct != state_.extras.end())
    {
        out << PanelJsonToDisplay(*direct);
        return FromUtf8(out.str());
    }
    if (panelId == "score" || panelId == "scores")
    {
        const auto scores = state_.metadata.find("scoresByPlayerId");
        if (scores != state_.metadata.end())
        {
            AppendJsonObjectLines(out, *scores);
            return FromUtf8(out.str());
        }
    }
    if (panelId == "hands")
    {
        const auto hands = state_.metadata.find("handsByPlayerId");
        if (hands != state_.metadata.end())
        {
            AppendJsonObjectLines(out, *hands);
            return FromUtf8(out.str());
        }
    }
    if (panelId == "discard")
    {
        const auto discard = state_.metadata.find("discard");
        if (discard != state_.metadata.end())
        {
            out << JsonToDisplay(*discard);
            return FromUtf8(out.str());
        }
    }
    out << "Information indisponible.";
    return FromUtf8(out.str());
}
}
