#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <algorithm>
#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>

#include "modules/gameplay/presentation/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::BindEvents()
{
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleKey(event); });
    linesList_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&) { UpdateInfoPanel(); });
}

void GamePlayPanel::HandleEvent(domain::GameEvent event)
{
    switch (event.type)
    {
    case domain::GameEventType::StateUpdated:
        if (event.state) ApplyState(std::move(*event.state));
        return;
    case domain::GameEventType::Acknowledged:
        UpdateStatus(wxString(L"Action reçue par le serveur."));
        return;
    case domain::GameEventType::ConnectionStatus:
        if (!event.message.empty()) UpdateStatus(FromUtf8(event.message), event.isError, true);
        return;
    case domain::GameEventType::Error:
        UpdateStatus(FromUtf8(event.message), true, true);
        return;
    case domain::GameEventType::Ignored:
        return;
    }
}

void GamePlayPanel::HandleKey(wxKeyEvent& event)
{
    const auto key = NormalizeKey(event);
    if (key.empty())
    {
        event.Skip();
        return;
    }

    if (key == "ENTER")
    {
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
        UpdateStatus(wxString(L"Aucune ligne sélectionnée."), true, true);
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
    const auto found = std::find_if(
        state_.shortcuts.begin(),
        state_.shortcuts.end(),
        [&normalizedKey](const domain::GameShortcut& shortcut)
        {
            return shortcut.normalizedKey == normalizedKey;
        });
    if (found == state_.shortcuts.end()) return false;
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
        if (normalizedKey == "Q")
        {
            UpdateStatus(wxString(L"Quitter la manche demandé."), false, true);
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
    UpdateStatus(FromUtf8("Panneau " + id + "."), false, true);
    return true;
}

std::optional<domain::GameAction> GamePlayPanel::ResolveShortcutAction(const std::string& actionType) const
{
    if (actionType.empty()) return std::nullopt;
    const int selection = linesList_->GetSelection();
    if (selection != wxNOT_FOUND && selection >= 0 && static_cast<std::size_t>(selection) < state_.lines.size())
    {
        const auto& line = state_.lines[static_cast<std::size_t>(selection)];
        if (line.actionIndex < state_.actions.size() &&
            state_.actions[line.actionIndex].type == actionType &&
            !state_.actions[line.actionIndex].disabled)
            return state_.actions[line.actionIndex];
    }
    const auto found = std::find_if(
        state_.actions.begin(),
        state_.actions.end(),
        [&actionType](const domain::GameAction& action)
        {
            return action.type == actionType && !action.disabled;
        });
    if (found == state_.actions.end()) return std::nullopt;
    return *found;
}

std::string GamePlayPanel::NormalizeKey(const wxKeyEvent& event) const
{
    const int key = event.GetKeyCode();
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER) return "ENTER";
    if (key == WXK_SPACE) return "SPACE";
    if (key == WXK_BACK) return "BACK";
    if (key == WXK_F5) return "F5";
    if (key >= 'A' && key <= 'Z') return std::string(1, static_cast<char>(key));
    if (key >= 'a' && key <= 'z') return std::string(1, static_cast<char>(key - 'a' + 'A'));
    if (key >= '0' && key <= '9') return std::string(1, static_cast<char>(key));
    return {};
}
}
