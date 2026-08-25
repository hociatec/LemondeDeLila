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
    if (IsFinished())
    {
        SendKey("ENTER");
        return true;
    }
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

    const auto key = NormalizeKey(event);
    if (IsFinished() && key == "ENTER")
    {
        SendKey(key);
        return true;
    }

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
        UpdateStatus(wxString(L"Cette carte ne peut pas Ãªtre jouÃ©e."), true, true);
        return true;
    }
    PrepareAndExecuteAction(std::move(*action));
    return true;
}
}
