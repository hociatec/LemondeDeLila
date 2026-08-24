#pragma once

#include <string>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::domain
{
struct GameAction final
{
    std::string type;
    std::string label;
    nlohmann::json payload = nlohmann::json::object();
    bool disabled = false;
    bool confirm = false;
};
}
