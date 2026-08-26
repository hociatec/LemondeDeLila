#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"
#include "modules/gameplay/actions/application/GameCommandSubmissionGuard.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceRollTracker.h"
#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"
#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/session/application/GameStartConfigurationFlow.h"
#include "modules/gameplay/session/infrastructure/GameEventPayloadCodec.h"
#include "modules/gameplay/state/application/GameStateUpdatePolicy.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/gameplay/history/presentation/GameLogCursor.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}


#include "gameplay/PromptTests.inc"
#include "gameplay/CardTests.inc"
#include "gameplay/PendingDiceTests.inc"
#include "gameplay/PawnAndStateTests.inc"
#include "gameplay/StartConfigurationFlowTests.inc"
#include "gameplay/ActionSubmissionGuardTests.inc"

int main()
{
    try
    {
        TestServerDrivenPrompt();
        TestStaleSetupPromptIsIgnoredDuringRound();
        TestPromptWithoutItsServerActionCannotReopen();
        TestTypedInputs();
        TestActionLabelsRemainDistinct();
        TestGenericCardsContract();
        TestCardsCarryTheirActionsAcrossGames();
        TestServerDrivenKeyboardActionsSurviveTheClientContract();
        TestOpaqueServerDrivenHandAndShortcuts();
        TestSpecializedActionsAreNotDuplicated();
        TestLegacySpecializedActionsAreNotDuplicated();
        TestPendingChoicesUseOnlyExplicitServerMappings();
        TestPendingChoicesStayPassiveWithoutServerMapping();
        TestGenericDiceContract();
        TestClassicRollActionContract();
        TestDiceRollTracker();
        TestServerDrivenPawnSelection();
        TestPawnSelectionHiddenForPassiveViewer();
        TestGameLogCursor();
        TestOlderGameStateCannotRestoreSetupPrompt();
        TestStartConfigurationIsSubmittedOnlyOnce();
        TestCommandSubmissionGuardSerializesGameplayCommands();
        TestStructuredGameAcknowledgements();
        std::cout << "Gameplay contract tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
