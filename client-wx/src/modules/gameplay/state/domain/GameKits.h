#pragma once

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::domain
{
struct GameKits final
{
    nlohmann::json cards;
    nlohmann::json dice;
    nlohmann::json grid;
    nlohmann::json movement;
    nlohmann::json pawns;
    nlohmann::json score;
    nlohmann::json resources;
    nlohmann::json counters;
    nlohmann::json status;
    nlohmann::json inventory;
    nlohmann::json economy;
    nlohmann::json ownership;
    nlohmann::json collections;
    nlohmann::json quiz;
    nlohmann::json submissions;

    [[nodiscard]] bool Has(const char* capability) const;
    [[nodiscard]] const nlohmann::json& Get(const char* capability) const;
};
}
