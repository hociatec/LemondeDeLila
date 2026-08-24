#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/presentation/GameActionPromptDialog.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::PrepareAndExecuteAction(domain::GameAction action)
{
    auto prepared = GameActionPromptDialog::Prepare(*this, std::move(action), state_.prompt);
    if (prepared) ExecuteAction(std::move(*prepared));
}
}
