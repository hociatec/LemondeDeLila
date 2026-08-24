#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/scrolwin.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/GamePlayFormatters.h"
#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"
#include "modules/gameplay/presentation/shortcuts/GameShortcutResolver.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"

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
            ExecuteAction(std::move(action));
        });
    promptPanel_->SetCancelHandler(
        [this](std::string cancelType)
        {
            if (cancelType.empty()) return;
            auto cancel = ResolveShortcutAction(cancelType);
            if (!cancel)
            {
                cancel = domain::GameAction{};
                cancel->type = std::move(cancelType);
            }
            ExecuteAction(std::move(*cancel));
        });
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
    const auto text = BuildInfoText(id);
    lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*infoText_, text);
    UpdateStatus(wxString(L"Informations affichées."));
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
