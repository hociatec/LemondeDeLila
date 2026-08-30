#pragma once

#include <map>
#include <string>
#include <variant>
#include <vector>

namespace lila::modules::gameplay::domain
{
struct GameValue final
{
    using Array = std::vector<GameValue>;
    using Object = std::map<std::string, GameValue>;
    using Storage = std::variant<std::monostate, bool, double, std::string, Array, Object>;

    Storage value;

    [[nodiscard]] bool operator==(const GameValue&) const = default;

    [[nodiscard]] bool Empty() const noexcept
    {
        if (std::holds_alternative<std::monostate>(value)) return true;
        if (const auto* array = std::get_if<Array>(&value)) return array->empty();
        if (const auto* object = std::get_if<Object>(&value)) return object->empty();
        if (const auto* text = std::get_if<std::string>(&value)) return text->empty();
        return false;
    }
};
}
