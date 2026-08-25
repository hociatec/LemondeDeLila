#include "modules/gameplay/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/scrolwin.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/hand/GameHandPanel.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"
#include "modules/gameplay/presentation/shortcuts/GameShortcutResolver.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::BindEvents()
{
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleKey(event); });
    linesList_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&) { UpdateInfoPanel(); });
    promptPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            contentPanel_->Show(!visible);
            Layout();
        });
    confirmationPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            contentPanel_->Show(!visible);
            Layout();
        });
    confirmationPanel_->SetConfirmedHandler(
        [this](domain::GameAction action)
        {
            PrepareAndExecuteAction(std::move(action));
        });
    promptPanel_->SetValidationErrorHandler(
        [this](const wxString& message, wxWindow*)
        {
            UpdateStatus(message, true, true);
        });
    promptPanel_->SetSubmitHandler(
        [this](domain::GameAction action)
        {
            dismissedPromptActionType_.clear();
            ExecuteAction(std::move(action));
            if (onZoneFocusRequested_) onZoneFocusRequested_();
        });
    promptPanel_->SetCancelHandler(
        [this](std::string)
        {
            if (state_.prompt) dismissedPromptActionType_ = state_.prompt->actionType;
            if (onZoneFocusRequested_) onZoneFocusRequested_();
        });
}

bool GamePlayPanel::ActivateFromZone()
{
    if (!IsOpen()) return false;
    if (IsConfirmationVisible() || IsInlinePromptVisible()) return true;
    if (state_.prompt)
    {
        dismissedPromptActionType_.clear();
        SyncInlinePrompt();
        return true;
    }
    if (handPanel_->Count() > 0) return ActivateSelectedHandCard();
    if (!state_.lines.empty())
    {
        ActivateSelectedLine();
        return true;
    }
    return false;
}

bool GamePlayPanel::HandleZoneKey(wxKeyEvent& event)
{
    if (!IsOpen() || IsConfirmationVisible() || IsInlinePromptVisible()) return false;

    const int keyCode = event.GetKeyCode();
    if ((keyCode == WXK_UP || keyCode == WXK_DOWN) && handPanel_->Count() > 0)
    {
        if (handPanel_->MoveSelection(keyCode == WXK_UP))
        {
            const auto label = handPanel_->SelectedLabel();
            if (!label.empty()) UpdateStatus(label, false, true);
        }
        return true;
    }

    const auto key = NormalizeKey(event);
    if (key == "F5")
    {
        RequestRefresh();
        return true;
    }
    if (!key.empty() && HandleShortcut(key)) return true;
    if (key == "T")
    {
        RequestTurn();
        return true;
    }
    return false;
}

bool GamePlayPanel::ActivateSelectedHandCard()
{
    const int selected = handPanel_->SelectedIndex();
    if (selected < 0) return false;
    auto action = shortcuts::GameShortcutResolver::ResolveHandAction(
        state_, static_cast<std::size_t>(selected));
    if (!action)
    {
        UpdateStatus(wxString(L"Cette carte ne peut pas être jouée."), true, true);
        return true;
    }
    PrepareAndExecuteAction(std::move(*action));
    return true;
}

void GamePlayPanel::HandleEvent(domain::GameEvent event)
{
    switch (event.type)
    {
    case domain::GameEventType::StateUpdated:
        if (event.state) ApplyState(std::move(*event.state));
        return;
    case domain::GameEventType::Acknowledged:
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
