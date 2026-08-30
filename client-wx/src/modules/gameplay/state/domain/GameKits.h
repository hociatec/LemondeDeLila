#pragma once

#include <map>
#include <optional>
#include <string>

#include "modules/gameplay/state/domain/GameCapabilities.h"
#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GameKits final
{
    std::optional<GameCardsView> cards;
    std::optional<GameDiceState> dice;
    std::optional<GameGridView> grid;
    std::optional<GameMovementView> movement;
    std::optional<GamePawnsView> pawns;
    std::optional<GameScoreView> score;
    std::optional<GameResourcesView> resources;
    std::optional<GameCountersView> counters;
    std::optional<GameStatusView> status;
    std::optional<GameInventoryView> inventory;
    std::optional<GameEconomyView> economy;
    std::optional<GameOwnershipView> ownership;
    std::optional<GameCollectionsView> collections;
    std::optional<GameQuizView> quiz;
    std::optional<GameSubmissionsView> submissions;
    std::map<std::string, GameValue> unknownCapabilities;

    [[nodiscard]] bool Has(const std::string& capability) const;
    [[nodiscard]] const GameValue* Unknown(const std::string& capability) const;
    [[nodiscard]] const std::vector<GameCard>& VisibleHand() const noexcept;
    [[nodiscard]] const GameDiceState* Dice() const noexcept;
};
}
