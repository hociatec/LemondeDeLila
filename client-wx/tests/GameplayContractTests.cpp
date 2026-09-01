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
#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"
#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"
#include "modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.h"
#include "modules/gameplay/session/application/GameStartConfigurationFlow.h"
#include "modules/gameplay/session/infrastructure/GameEventPayloadCodec.h"
#include "modules/gameplay/state/application/GameStateUpdatePolicy.h"
#include "modules/gameplay/state/application/GamePendingSelectionPolicy.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/gameplay/session/infrastructure/GameCommandPayloadCodec.h"
#include "modules/gameplay/history/presentation/GameLogCursor.h"
#include "modules/gameplay/events/presentation/GameEventPresenter.h"
#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"
#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "modules/gameplay/grid/application/GameGridActionResolver.h"
#include "modules/gameplay/shortcuts/application/GameGenericShortcutPolicy.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

nlohmann::json V2Payload(const nlohmann::json& legacy)
{
    auto source = legacy.value("state", legacy);
    nlohmann::json system{
        {"match", {{"status", source.value("status", "playing")},
            {"startedAtMs", nullptr}, {"finishedAtMs", nullptr},
            {"result", nullptr}, {"playerStatuses", nlohmann::json::object()}}},
        {"round", {{"number", source.value("round", 0)}, {"status", "playing"},
            {"starterPlayerId", nullptr}, {"participantPlayerIds", nlohmann::json::array()},
            {"leftPlayerIds", nlohmann::json::array()}, {"winnerPlayerIds", nlohmann::json::array()},
            {"completedRounds", 0}}},
        {"turn", {{"currentPlayerId", nullptr}, {"direction", 1},
            {"number", source.value("turnIndex", 0)}, {"actionPointsRemaining", nullptr},
            {"immediateExtraTurns", 0}, {"extraCount", 0},
            {"skipTurnsByPlayer", nlohmann::json::object()},
            {"extraTurnsByPlayer", nlohmann::json::object()},
            {"replacementTurnsByPlayer", nlohmann::json::object()},
            {"waitingSessionId", nullptr}, {"waitingPlayerIds", nlohmann::json::array()}}},
        {"players", {{"all", nlohmann::json::array()}}},
        {"setup", {{"complete", false}, {"phase", source.value("phase", "turn")},
            {"ownerPlayerId", nullptr}, {"values", nlohmann::json::object()}}},
        {"events", {{"latestByType", nlohmann::json::object()}}},
        {"shortcuts", nlohmann::json::array()}};
    const auto extras = source.value("extras", nlohmann::json::object());
    if (extras.contains("shortcuts")) system["shortcuts"] = extras["shortcuts"];
    nlohmann::json kits{{"score", {{"byPlayer", nlohmann::json::object()},
        {"leaderboard", nlohmann::json::array()}}}};
    if (extras.contains("hand")) kits["cards"] = {{"hands", {{"main", {
        {"visibility", "owner"}, {"byPlayer", {{"1", extras["hand"]}}}}}}}};
    if (extras.contains("dice")) kits["dice"] = extras["dice"];
    nlohmann::json result{
        {"viewVersion", 1}, {"roomId", legacy.value("roomId", 1)},
        {"runId", legacy.value("runId", 0)},
        {"version", legacy.value("version", 1)}, {"gameType", legacy.value("gameType", "test")},
        {"system", std::move(system)}, {"kits", std::move(kits)},
        {"effect", nlohmann::json::object()}, {"game", nlohmann::json::object()},
        {"actions", source.value("actions", nlohmann::json::array())},
        {"actionCatalog", nlohmann::json::array()}, {"timers", nlohmann::json::object()}};
    if (source.contains("pending")) result["pending"] = source["pending"];
    return result;
}


#include "gameplay/PromptTests.inc"
#include "gameplay/CardTests.inc"
#include "gameplay/CardPresentationTests.inc"
#include "gameplay/PendingDiceTests.inc"
#include "gameplay/PawnAndStateTests.inc"
#include "gameplay/StartConfigurationFlowTests.inc"
#include "gameplay/ActionSubmissionGuardTests.inc"
#include "gameplay/TypedCapabilityTests.inc"

int main()
{
    try
    {
        TestServerDrivenPrompt();
        TestStaleSetupPromptIsIgnoredDuringRound();
        TestPromptWithoutItsServerActionCannotReopen();
        TestTypedInputs();
        TestActionCatalogBuildsTypedControls();
        TestActionLabelsRemainDistinct();
        TestGenericCardsContract();
        TestCardsCarryTheirActionsAcrossGames();
        TestServerDrivenKeyboardActionsSurviveTheClientContract();
        TestOpaqueServerDrivenHandAndShortcuts();
        TestSpecializedActionsAreNotDuplicated();
        TestUnmappedSpecializedActionsRemainGeneric();
        TestPendingChoicesUseOnlyExplicitServerMappings();
        TestPendingChoicesStayPassiveWithoutServerMapping();
        TestGenericDiceContract();
        TestClassicRollActionContract();
        TestServerDrivenPawnSelection();
        TestPawnSelectionHiddenForPassiveViewer();
        TestGameLogCursor();
        TestOlderGameStateCannotRestoreSetupPrompt();
        TestStartConfigurationIsSubmittedOnlyOnce();
        TestCommandSubmissionGuardSerializesGameplayCommands();
        TestStructuredGameAcknowledgements();
        TestStructuredBackendErrorsAreReadable();
        TestActionCandidatesContract();
        TestCapabilityInformationIsInspectable();
        TestKnownCapabilitiesAreTyped();
        TestEmptyV2KitsAndCapabilitiesRemainValid();
        TestPendingMultipleWorkflowsUseOneExplicitAction();
        TestPendingSelectionPolicy();
        TestEventsHaveStableIdentityAndAccessibleText();
        TestTechnicalEngineEventsStayOutOfPlayerHistory();
        TestGridActionResolutionUsesBoardAndCell();
        std::cout << "Gameplay contract tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
