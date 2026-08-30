#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/cards/domain/GameCard.h"
#include "modules/gameplay/dice/domain/GameDiceState.h"
#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GameCardsView final
{
    std::vector<GameCard> visibleHand;
    GameValue decks;
    GameValue discards;
    GameValue hands;
    GameValue zones;
};

struct GameMovementTrack final
{
    std::string id;
    int spaces = 0;
    std::string overshoot;
    std::map<std::string, int> positions;
};
struct GameMovementView final { std::vector<GameMovementTrack> tracks; };

struct GamePawnView final
{
    std::string setId;
    std::string id;
    std::string label;
    std::optional<int> ownerId;
    int position = 0;
};
struct GamePawnsView final { std::vector<GamePawnView> pawns; };

struct GameScoreEntry final { int playerId = 0; double score = 0; int rank = 0; };
struct GameScoreView final
{
    std::map<int, double> byPlayer;
    std::vector<GameScoreEntry> leaderboard;
};

struct GameNamedAmount final { std::string id; double value = 0; };
struct GamePlayerAmounts final { int playerId = 0; std::vector<GameNamedAmount> values; };
struct GameResourcesView final { std::vector<GamePlayerAmounts> players; };
struct GameCountersView final { std::vector<GameNamedAmount> values; };

struct GameStatusValue final
{
    std::string id;
    int playerId = 0;
    std::optional<int> remaining;
    std::string scope;
    GameValue data;
};
struct GameStatusView final { std::vector<GameStatusValue> values; };

struct GameInventoryPlayer final
{
    int playerId = 0;
    std::map<std::string, int> quantities;
    std::optional<int> hiddenCount;
};
struct GameInventorySet final
{
    std::string id;
    std::string visibility;
    std::vector<GameInventoryPlayer> players;
};
struct GameInventoryView final { std::vector<GameInventorySet> sets; };

struct GameMarketView final
{
    std::string id;
    std::string currency;
    std::vector<GameNamedAmount> prices;
};
struct GameEconomyView final { std::vector<GameMarketView> markets; };

struct GameOwnedAsset final
{
    std::string registryId;
    std::string assetId;
    std::vector<int> ownerIds;
};
struct GameOwnershipView final { std::vector<GameOwnedAsset> assets; };

struct GameCollectionGroup final
{
    std::string id;
    int count = 0;
    std::vector<std::string> items;
};
struct GamePlayerCollection final
{
    std::string collectionId;
    int playerId = 0;
    int total = 0;
    std::vector<GameCollectionGroup> groups;
};
struct GameCollectionsView final { std::vector<GamePlayerCollection> players; };

struct GameQuizBank final { std::string id; int count = 0; int cursor = 0; int remaining = 0; };
struct GameQuizSession final
{
    std::string id;
    std::string bankId;
    std::string phase;
    std::string prompt;
    std::vector<std::string> choices;
    std::vector<int> participantPlayerIds;
    std::vector<int> answeredPlayerIds;
    std::optional<int> myAnswer;
    std::optional<int> correctAnswerIndex;
    bool scored = false;
};
struct GameQuizView final
{
    std::vector<GameQuizBank> banks;
    std::vector<GameQuizSession> sessions;
};

struct GameSubmissionSession final
{
    std::string id;
    std::string kind;
    std::vector<int> participantPlayerIds;
    std::vector<int> submittedPlayerIds;
    std::vector<int> pendingPlayerIds;
    bool closed = false;
    bool revealed = false;
    std::map<int, GameValue> visibleValues;
    std::optional<GameValue> ownValue;
};
struct GameSubmissionJudge final
{
    std::string id;
    std::optional<int> playerId;
    std::vector<int> playerIds;
    int index = 0;
};
struct GameSubmissionsView final
{
    std::string stage;
    std::vector<GameSubmissionSession> sessions;
    std::vector<GameSubmissionJudge> judges;
};

struct GameGridCellView final
{
    std::string boardId;
    std::string id;
    int x = 0;
    int y = 0;
    bool blocked = false;
    bool occupied = false;
    std::string kind;
    std::string entityId;
    std::string pawnId;
    std::optional<int> ownerId;
    std::string label;
    GameValue data;
};
struct GameGridOverlayView final
{
    std::string boardId;
    std::string layer;
    std::string kind;
    std::string cellId;
    std::string fromCellId;
    std::string toCellId;
    std::optional<int> ownerId;
    std::string label;
};
struct GameGridBoardView final
{
    std::string id;
    int width = 1;
    int height = 1;
    std::vector<GameGridCellView> cells;
    std::vector<GameGridOverlayView> overlays;
};
struct GameGridView final { std::vector<GameGridBoardView> boards; };

struct GameEffectView final
{
    std::optional<int> sourcePlayerId;
    std::string sourceCardId;
    std::string sourceDeckId;
    std::string sourceTileId;
    std::string status;
    bool resolved = false;
    GameValue data;
};
struct GameTimerView final
{
    std::string id;
    std::string label;
    std::optional<std::int64_t> deadlineMs;
    std::optional<std::int64_t> remainingMs;
    bool paused = false;
};
}
