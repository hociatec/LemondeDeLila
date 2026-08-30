#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <utility>

#include <wx/listbox.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::PrepareAndExecuteAction(domain::GameAction action)
{
    if (action.confirm)
    {
        promptPanel_->HidePrompt();
        confirmationPanel_->ShowConfirmation(std::move(action));
        return;
    }
    if (state_.prompt && state_.prompt->actionType == action.type)
    {
        ShowInlinePrompt(std::move(action));
        return;
    }
    if (const auto prompt = application::GameActionPromptFactory::Build(
            action, state_.actionCatalog))
    {
        confirmationPanel_->HideConfirmation();
        promptPanel_->ShowPrompt(*prompt, std::move(action));
        return;
    }
    ExecuteAction(std::move(action));
}

bool GamePlayPanel::IsInlinePromptVisible() const
{
    return promptPanel_ != nullptr && promptPanel_->IsActive();
}

bool GamePlayPanel::IsConfirmationVisible() const
{
    return confirmationPanel_ != nullptr && confirmationPanel_->IsActive();
}

void GamePlayPanel::SyncInlinePrompt()
{
    if (!state_.prompt)
    {
        dismissedPromptActionType_.clear();
        submittedPromptActionType_.clear();
        promptPanel_->HidePrompt(true);
        return;
    }
    if (!roomStarted_ && !roomStartFlowRequested_)
    {
        promptPanel_->HidePrompt(false);
        return;
    }
    if (!submittedPromptActionType_.empty() &&
        submittedPromptActionType_ != state_.prompt->actionType)
        submittedPromptActionType_.clear();
    if (submittedPromptActionType_ == state_.prompt->actionType)
    {
        promptPanel_->HidePrompt(false);
        return;
    }
    if (dismissedPromptActionType_ == state_.prompt->actionType)
    {
        promptPanel_->HidePrompt(false);
        return;
    }

    auto action = ResolveShortcutAction(state_.prompt->actionType);
    if (!action)
    {
        promptPanel_->HidePrompt(false);
        return;
    }
    ShowInlinePrompt(std::move(*action));
}

void GamePlayPanel::ShowInlinePrompt(domain::GameAction action)
{
    if (!state_.prompt || state_.prompt->actionType != action.type) return;
    confirmationPanel_->HideConfirmation();
    promptPanel_->ShowPrompt(*state_.prompt, std::move(action));
}

bool GamePlayPanel::ActivateSelectedPendingChoice()
{
    if (!state_.pending || !state_.pending->viewerActionable) return false;
    if (state_.pending->multipleSelection)
    {
        wxArrayInt selections;
        const auto count = choicesList_->GetSelections(selections);
        if (count < state_.pending->minimumSelections ||
            count > state_.pending->maximumSelections)
        {
            UpdateStatus(wxString::Format(
                L"Sélectionnez entre %d et %d éléments.",
                state_.pending->minimumSelections,
                state_.pending->maximumSelections), true, true);
            return true;
        }
        if (!state_.pending->selectionAction) return false;
        auto action = *state_.pending->selectionAction;
        action.payload["value"] = nlohmann::json::array();
        for (const auto selected : selections)
            if (selected >= 0 && static_cast<std::size_t>(selected) < state_.pending->choices.size())
                action.payload["value"].push_back(
                    state_.pending->choices[static_cast<std::size_t>(selected)].value);
        PrepareAndExecuteAction(std::move(action));
        return true;
    }
    const int selected = choicesList_->GetSelection();
    if (selected == wxNOT_FOUND || selected < 0 ||
        static_cast<std::size_t>(selected) >= state_.pending->choices.size())
        return false;
    const auto& choice = state_.pending->choices[static_cast<std::size_t>(selected)];
    if (!choice.action)
    {
        UpdateStatus(wxString(L"Ce choix n'a pas d'action fournie par le serveur."), true, true);
        return true;
    }
    PrepareAndExecuteAction(*choice.action);
    return true;
}
}
