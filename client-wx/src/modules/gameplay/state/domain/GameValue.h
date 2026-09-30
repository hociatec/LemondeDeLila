#pragma once

#include <cmath>
#include <cstddef>
#include <limits>
#include <map>
#include <optional>
#include <string>
#include <utility>
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

    GameValue() = default;
    GameValue(std::nullptr_t) noexcept : value(std::monostate{}) {}
    GameValue(bool input) : value(input) {}
    GameValue(int input) : value(static_cast<double>(input)) {}
    GameValue(long long input) : value(static_cast<double>(input)) {}
    GameValue(double input) : value(input) {}
    GameValue(const char* input) : value(std::string(input == nullptr ? "" : input)) {}
    GameValue(std::string input) : value(std::move(input)) {}
    GameValue(Array input) : value(std::move(input)) {}
    GameValue(Object input) : value(std::move(input)) {}

    [[nodiscard]] bool operator==(const GameValue&) const = default;

    [[nodiscard]] const std::string* Text() const noexcept
    {
        return std::get_if<std::string>(&value);
    }

    [[nodiscard]] const Object* ObjectValue() const noexcept
    {
        return std::get_if<Object>(&value);
    }

    [[nodiscard]] Object* ObjectValue() noexcept
    {
        return std::get_if<Object>(&value);
    }

    [[nodiscard]] const Array* ArrayValue() const noexcept
    {
        return std::get_if<Array>(&value);
    }

    [[nodiscard]] Array* ArrayValue() noexcept
    {
        return std::get_if<Array>(&value);
    }

    [[nodiscard]] std::optional<int> Integer() const noexcept
    {
        const auto* number = std::get_if<double>(&value);
        if (number == nullptr || !std::isfinite(*number) || std::trunc(*number) != *number ||
            *number < static_cast<double>((std::numeric_limits<int>::min)()) ||
            *number > static_cast<double>((std::numeric_limits<int>::max)()))
            return std::nullopt;
        return static_cast<int>(*number);
    }

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
