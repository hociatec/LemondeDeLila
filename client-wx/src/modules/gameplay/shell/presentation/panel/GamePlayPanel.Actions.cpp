#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <utility>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

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
        promptPanel_->HidePrompt(true);
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
        action = domain::GameAction{};
        action->type = state_.prompt->actionType;
        const auto found = std::find_if(
            state_.actions.begin(), state_.actions.end(),
            [this](const domain::GameAction& candidate)
            {
                return candidate.type == state_.prompt->actionType;
            });
        if (found != state_.actions.end()) *action = *found;
    }
    ShowInlinePrompt(std::move(*action));
}

void GamePlayPanel::ShowInlinePrompt(domain::GameAction action)
{
    if (!state_.prompt || state_.prompt->actionType != action.type) return;
    confirmationPanel_->HideConfirmation();
    promptPanel_->ShowPrompt(*state_.prompt, std::move(action));
}
}
