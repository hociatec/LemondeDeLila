#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <utility>

#include <wx/listbox.h>
#include <wx/rearrangectrl.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

namespace lila::modules::gameplay::presentation
{
const domain::GamePrompt* GamePlayPanel::ActivePrompt() const noexcept
{
    return state_.pending && state_.pending->prompt
        ? &*state_.pending->prompt : nullptr;
}

void GamePlayPanel::PrepareAndExecuteAction(domain::GameAction action)
{
    if (action.confirm)
    {
        promptPanel_->HidePrompt();
        confirmationPanel_->ShowConfirmation(std::move(action));
        return;
    }
    if (const auto* prompt = ActivePrompt(); prompt && prompt->actionType == action.type)
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
    const auto* prompt = ActivePrompt();
    if (prompt == nullptr)
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
        submittedPromptActionType_ != prompt->actionType)
        submittedPromptActionType_.clear();
    if (submittedPromptActionType_ == prompt->actionType)
    {
        promptPanel_->HidePrompt(false);
        return;
    }
    if (dismissedPromptActionType_ == prompt->actionType)
    {
        promptPanel_->HidePrompt(false);
        return;
    }

    auto action = ResolveShortcutAction(prompt->actionType);
    if (!action)
    {
        promptPanel_->HidePrompt(false);
        return;
    }
    ShowInlinePrompt(std::move(*action));
}

void GamePlayPanel::ShowInlinePrompt(domain::GameAction action)
{
    const auto* prompt = ActivePrompt();
    if (prompt == nullptr || prompt->actionType != action.type) return;
    confirmationPanel_->HideConfirmation();
    promptPanel_->ShowPrompt(*prompt, std::move(action));
}

bool GamePlayPanel::ActivateSelectedPendingChoice()
{
    if (!state_.pending || !state_.pending->viewerActionable) return false;
    if (state_.pending->multipleSelection)
    {
        if (!state_.pending->selectionAction) return false;
        auto action = *state_.pending->selectionAction;
        action.payload["value"] = nlohmann::json::array();
        if (state_.pending->ordering)
        {
            for (const int encodedIndex : orderingChoices_->GetList()->GetCurrentOrder())
            {
                const int index = encodedIndex < 0 ? ~encodedIndex : encodedIndex;
                if (index >= 0 && static_cast<std::size_t>(index) < pendingChoiceIndexes_.size() &&
                    pendingChoiceIndexes_[static_cast<std::size_t>(index)] < state_.pending->choices.size())
                    action.payload["value"].push_back(infrastructure::EncodeGameValue(
                        state_.pending->choices[
                            pendingChoiceIndexes_[static_cast<std::size_t>(index)]].value));
            }
            PrepareAndExecuteAction(std::move(action));
            return true;
        }
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
        for (const auto selected : selections)
            if (selected >= 0 && static_cast<std::size_t>(selected) < state_.pending->choices.size())
                action.payload["value"].push_back(infrastructure::EncodeGameValue(
                    state_.pending->choices[static_cast<std::size_t>(selected)].value));
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
