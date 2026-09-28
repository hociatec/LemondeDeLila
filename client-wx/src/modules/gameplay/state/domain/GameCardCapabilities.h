#pragma once

#include <string>
#include <vector>

#include "modules/gameplay/cards/domain/GameCard.h"

namespace lila::modules::gameplay::domain
{
struct GameDeckView final { std::string id; int count = 0; };
struct GameDiscardView final
{
    std::string id;
    int count = 0;
    std::vector<GameCard> cards;
};
struct GameHandPlayerView final
{
    int playerId = 0;
    int count = 0;
    bool cardsVisible = false;
    std::vector<GameCard> cards;
};
struct GameHandView final
{
    std::string id;
    std::string visibility;
    std::vector<GameHandPlayerView> players;
};
struct GameCardZoneView final
{
    std::string id;
    std::string visibility;
    int count = 0;
    bool cardsVisible = false;
    std::vector<GameCard> cards;
};
struct GameCardsView final
{
    std::vector<GameCard> visibleHand;
    std::vector<GameDeckView> decks;
    std::vector<GameDiscardView> discards;
    std::vector<GameHandView> hands;
    std::vector<GameCardZoneView> zones;
};
}
