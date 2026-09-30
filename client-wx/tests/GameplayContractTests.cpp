#include <chrono>
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
#include "modules/gameplay/state/application/GamePendingAccessibilityText.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/gameplay/session/infrastructure/GameCommandPayloadCodec.h"
#include "modules/gameplay/history/presentation/GameLogCursor.h"
#include "modules/gameplay/events/presentation/GameEventPresenter.h"
#include "modules/gameplay/events/application/GameSoundEventPolicy.h"
#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "modules/gameplay/grid/application/GameGridActionResolver.h"
#include "modules/gameplay/grid/application/GameGridCoordinate.h"
#include "modules/gameplay/grid/application/GridPlayerCellText.h"
#include "modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.h"
#include "modules/gameplay/shortcuts/application/GameGenericShortcutPolicy.h"
#include "shared/data/application/IntegerText.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

nlohmann::json BuildGameView(const nlohmann::json& fixture);

void TestLargeSnapshotParsingCost()
{
    auto payload = BuildGameView({{"roomId", 500}, {"gameType", "large-snapshot"}});
    for (int id = 1; id <= 128; ++id)
    {
        payload["system"]["players"]["all"].push_back({
            {"id", id}, {"username", "Player-" + std::to_string(id)}});
        payload["actions"].push_back({
            {"type", "opaque.action." + std::to_string(id)},
            {"label", "Action " + std::to_string(id)},
            {"payload", {{"playerId", id}, {"value", id}}}});
    }
    nlohmann::json cards = nlohmann::json::array();
    for (int id = 0; id < 1'024; ++id)
        cards.push_back({{"id", "card-" + std::to_string(id)}, {"label", "Card"}});
    payload["kits"]["cards"] = {{"hands", {{"main", {
        {"visibility", "public"}, {"byPlayer", {{"1", std::move(cards)}}}}}}}};

    constexpr int Iterations = 20;
    const auto startedAt = std::chrono::steady_clock::now();
    for (int iteration = 0; iteration < Iterations; ++iteration)
    {
        const auto state = lila::modules::gameplay::infrastructure::
            GameStatePayloadCodec::DecodeState(payload);
        Expect(state.actions.size() == 128 && state.system.players.size() == 128 &&
                state.kits.cards && state.kits.VisibleHand().size() == 1'024,
            "Le gros snapshot doit être décodé entièrement.");
    }
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - startedAt);
    Expect(elapsed < std::chrono::seconds(5),
        "Le parsing répété de gros snapshots dépasse cinq secondes.");
    std::cout << "Large snapshot parsing: " << elapsed.count() / Iterations
              << " ms/snapshot (" << Iterations << " iterations).\n";
}

nlohmann::json BuildGameView(const nlohmann::json& fixture)
{
    auto source = fixture.value("state", fixture);
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
        {"viewVersion", 1}, {"roomId", fixture.value("roomId", 1)},
        {"viewerPlayerId", fixture.contains("viewerPlayerId")
            ? fixture["viewerPlayerId"] : nlohmann::json(nullptr)},
        {"runId", fixture.value("runId", 0)},
        {"version", fixture.value("version", 1)}, {"gameType", fixture.value("gameType", "test")},
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
#include "gameplay/PositionShortcutTests.inc"

int main()
{
    try
    {
        const auto morpion = lila::modules::gameplay::infrastructure::GameBoardCapabilitiesDecoder::Grid(
            {{"boards", {{"morpion", {{"width", 3}, {"height", 3},
                {"cells", {{"0,0", 1}, {"1,1", -2}, {"2,2", nullptr}}}}}}}});
        const std::vector<lila::modules::gameplay::domain::GamePlayer> players{
            {1, "hacene"}, {-2, "Marcelino", true}};
        const auto& cells = morpion->boards[0].cells;
        using lila::modules::gameplay::application::grid::GridPlayerCellText;
        Expect(cells[0].ownerId == 1 && cells[4].ownerId == -2,
            "Morpion must preserve human and bot cell ownership");
        Expect(GridPlayerCellText(cells[0], players) == "A1, hacene",
            "Occupied Morpion cells must announce the player's name");
        Expect(GridPlayerCellText(cells[4], players) == "B2, Marcelino",
            "Occupied Morpion cells must announce the bot's name");
        Expect(GridPlayerCellText(cells[1], players) == "B1" &&
            GridPlayerCellText(cells[8], players) == "C3",
            "Empty Morpion cells must announce only their coordinate");
        const auto corridor = lila::modules::gameplay::infrastructure::GameBoardCapabilitiesDecoder::Grid(
            {{"boards", {{"pathWalls", {{"width", 9}, {"height", 9},
                {"cells", {{"4,0", 1}, {"4,8", -2}}}}}}}});
        Expect(GridPlayerCellText(corridor->boards[0].cells[4], players) == "E1, hacene" &&
            GridPlayerCellText(corridor->boards[0].cells[76], players) == "E9, Marcelino",
            "Corridor cells must identify human and bot occupants");
        for (const auto orientation : {"h", "v"})
        {
            const auto grid = lila::modules::gameplay::infrastructure::GameBoardCapabilitiesDecoder::Grid(
                {{"boards", {{"test", {{"width", 9}, {"height", 9},
                    {"overlays", {{"walls", nlohmann::json::array({
                        {{"x", 0}, {"y", 0}, {"orientation", orientation}}
                    })}}}}}}}});
            const auto& edges = grid->boards[0].overlays;
            Expect(edges.size() == 4, "A wall must describe both sides of both blocked passages");
            Expect(edges[0].cellId == "0,0", "Wall must be attached to its cell");
            Expect(edges[0].label == (std::string(orientation) == "h"
                ? "horizontal, passage bloqué vers A2" : "vertical, passage bloqué vers B1"),
                "Wall orientation and blocked destination must be readable");
            Expect(edges[1].label.find("vers A1") != std::string::npos,
                "Wall must also be readable from the opposite side");
        }
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
        TestGameLogCursor();
        TestOlderGameStateCannotRestoreSetupPrompt();
        TestStartConfigurationIsSubmittedOnlyOnce();
        TestCommandSubmissionGuardSerializesGameplayCommands();
        TestStructuredGameAcknowledgements();
        TestStructuredBackendErrorsAreReadable();
        TestActionCandidatesContract();
        TestCapabilityInformationIsInspectable();
        TestKnownCapabilitiesAreTyped();
        TestProjectionCompatibilityAndLimits();
        TestUnknownGameUsesOnlyPublicCapabilities();
        TestUnknownWorkflowHasAccessibleFallback();
        TestNumericNetworkKeysAreStrictlyValidated();
        TestInvalidChoiceIndexesAndPlayerIdsAreRejected();
        TestDisplayedTimersIgnoreSystemClockChanges();
        TestLargeSnapshotParsingCost();
        TestBoardPositionShortcuts();
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
