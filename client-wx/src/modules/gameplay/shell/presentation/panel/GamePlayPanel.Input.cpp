#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::HandleEvent(domain::GameEvent event)
{
    switch (event.type)
    {
    case domain::GameEventType::StateUpdated:
        if (event.state) ApplyState(std::move(*event.state));
        return;
    case domain::GameEventType::Acknowledged:
        if (event.message == "start") RequestRefresh();
        return;
    case domain::GameEventType::TurnUpdated:
    {
        const auto message = event.message.empty()
            ? wxString(L"Tour inconnu.")
            : wxString(L"C'est au tour de ") + FromUtf8(event.message) + wxString(L".");
        if (onHistoryMessage_) onHistoryMessage_(message);
        return;
    }
    case domain::GameEventType::Error:
        UpdateStatus(FromUtf8(event.message), true, true);
        return;
    case domain::GameEventType::Ignored:
        return;
    }
}

void GamePlayPanel::HandleKey(wxKeyEvent& event)
{
    if (IsConfirmationVisible())
    {
        if (confirmationPanel_->HandleKey(event)) return;
        event.Skip();
        return;
    }
    if (IsInlinePromptVisible())
    {
        if (promptPanel_->HandleKey(event)) return;
        event.Skip();
        return;
    }
    if (pawnSelectionPanel_->IsActive())
    {
        if (pawnSelectionPanel_->HandleKey(event)) return;
        event.Skip();
        return;
    }

    const int keyCode = event.GetKeyCode();
    const bool tableShortcutHasPriority =
        event.ControlDown() || event.AltDown() || event.MetaDown() ||
        keyCode == 'Q' || keyCode == 'q' || keyCode == 'X' || keyCode == 'x';
    if (tableShortcutHasPriority && onTableShortcut_ && onTableShortcut_(event)) return;

    const auto key = NormalizeKey(event);
    if (key.empty())
    {
        event.Skip();
        return;
    }

    if (key == "ENTER")
    {
        if (IsFinished())
        {
            SendKey(key);
            return;
        }
        ActivateSelectedLine();
        return;
    }
    if (key == "F5")
    {
        RequestRefresh();
        return;
    }
    if (HandleShortcut(key)) return;
    event.Skip();
}

void GamePlayPanel::ActivateSelectedLine()
{
    const int selection = linesList_->GetSelection();
    if (selection == wxNOT_FOUND || selection < 0 || static_cast<std::size_t>(selection) >= state_.lines.size())
    {
        UpdateStatus(wxString(L"Aucune ligne sÃ©lectionnÃ©e."), true, true);
        return;
    }
    const auto& line = state_.lines[static_cast<std::size_t>(selection)];
    if (!line.enabled || line.actionIndex == domain::GameLine::NoAction ||
        line.actionIndex >= state_.actions.size())
    {
        activeInfoPanel_ = "details";
        UpdateInfoPanel();
        UpdateStatus(wxString(L"Ligne informative."), false, true);
        return;
    }
    PrepareAndExecuteAction(state_.actions[line.actionIndex]);
}

bool GamePlayPanel::HandleShortcut(const std::string& normalizedKey)
{
    const auto* found = shortcuts::GameShortcutResolver::Find(state_, normalizedKey);
    if (found == nullptr) return false;
    if (found->kind == domain::GameShortcutKind::Interface)
    {
        return HandleInterfaceShortcut(found->id);
    }
    if (found->kind == domain::GameShortcutKind::Action)
    {
        auto action = ResolveShortcutAction(found->actionType);
        if (!action)
        {
            UpdateStatus(wxString(L"Action indisponible."), true, true);
            return true;
        }
        PrepareAndExecuteAction(std::move(*action));
        return true;
    }
    return false;
}

bool GamePlayPanel::HandleInterfaceShortcut(const std::string& id)
{
    if (id.empty()) return false;
    activeInfoPanel_ = id;
    UpdateInfoPanel();
    const auto text = BuildInfoText(id);
    if (onHistoryMessage_ && !text.empty()) onHistoryMessage_(text);
    return true;
}

std::optional<domain::GameAction> GamePlayPanel::ResolveShortcutAction(const std::string& actionType) const
{
    return shortcuts::GameShortcutResolver::ResolveAction(
        state_, actionType, linesList_->GetSelection());
}

std::string GamePlayPanel::NormalizeKey(const wxKeyEvent& event) const
{
    return shortcuts::GameShortcutResolver::NormalizeKey(event);
}
}
