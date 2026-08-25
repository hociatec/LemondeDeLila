#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/scrolwin.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/dice/presentation/GameDicePanel.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::BindEvents()
{
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleKey(event); });
    linesList_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&) { UpdateInfoPanel(); });
    promptPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    confirmationPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    pawnSelectionPanel_->SetVisibilityChangedHandler(
        [this](bool visible)
        {
            static_cast<void>(visible);
            SyncContentVisibility();
        });
    pawnSelectionPanel_->SetSubmitHandler(
        [this](domain::GameAction action)
        {
            ExecuteAction(std::move(action));
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
            submittedPromptActionType_ = action.type;
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
    if (pawnSelectionPanel_->IsActive()) return pawnSelectionPanel_->FocusSelection();
    const bool promptSubmissionPending = state_.prompt &&
        submittedPromptActionType_ == state_.prompt->actionType;
    if (state_.prompt)
    {
        if (submittedPromptActionType_ != state_.prompt->actionType)
        {
            dismissedPromptActionType_.clear();
            SyncInlinePrompt();
            return true;
        }
    }
    if (handPanel_->Count() > 0) return ActivateSelectedHandCard();
    if (HasDiceAction()) return ActivateSelectedDie();
    if (promptSubmissionPending) return true;
    if (!state_.lines.empty())
    {
        ActivateSelectedLine();
        return true;
    }
    return false;
}

bool GamePlayPanel::HandleZoneKey(wxKeyEvent& event)
{
    if (!IsOpen() || IsConfirmationVisible() || IsInlinePromptVisible() ||
        pawnSelectionPanel_->IsActive()) return false;

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
    if ((keyCode == WXK_UP || keyCode == WXK_DOWN) && state_.dice)
    {
        if (dicePanel_->MoveSelection(keyCode == WXK_UP))
        {
            const auto label = dicePanel_->SelectedLabel();
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
    auto action = application::cards::GameCardActionResolver::Resolve(
        state_.hand, state_.actions, static_cast<std::size_t>(selected));
    if (!action)
    {
        UpdateStatus(wxString(L"Cette carte ne peut pas \u00EAtre jou\u00E9e."), true, true);
        return true;
    }
    PrepareAndExecuteAction(std::move(*action));
    return true;
}

bool GamePlayPanel::ActivateSelectedDie()
{
    if (!state_.dice) return false;
    const int selected = dicePanel_->SelectedIndex();
    const auto index = selected >= 0 ? static_cast<std::size_t>(selected) : std::size_t{0};
    auto action = application::dice::GameDiceActionResolver::Resolve(
        *state_.dice, state_.actions, index);
    if (!action) return false;
    PrepareAndExecuteAction(std::move(*action));
    return true;
}
}
