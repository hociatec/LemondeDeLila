#pragma once

#include <cstdint>
#include <string>
#include <functional>

namespace lila::shared::domain
{
struct UserId
{
    std::int64_t value = 0;

    UserId() = default;
    UserId(std::int64_t rawValue) : value(rawValue) {}
    UserId& operator=(std::int64_t rawValue)
    {
        value = rawValue;
        return *this;
    }

    bool operator==(const UserId& other) const { return value == other.value; }
    bool operator!=(const UserId& other) const { return value != other.value; }
    bool operator<(const UserId& other) const { return value < other.value; }
    operator std::int64_t() const { return value; }
    [[nodiscard]] bool IsValid() const { return value > 0; }
};

struct MessageId
{
    std::string value;

    MessageId() = default;
    MessageId(std::string rawValue) : value(std::move(rawValue)) {}
    MessageId(const char* rawValue) : value(rawValue == nullptr ? "" : rawValue) {}
    MessageId& operator=(std::string rawValue)
    {
        value = std::move(rawValue);
        return *this;
    }

    bool operator==(const MessageId& other) const { return value == other.value; }
    bool operator!=(const MessageId& other) const { return value != other.value; }
    operator const std::string&() const { return value; }
    [[nodiscard]] bool empty() const { return value.empty(); }
    [[nodiscard]] bool IsValid() const { return !value.empty(); }
};

enum class ProfileVisibility
{
    Public,
    Friends,
    Private
};

inline const char* ProfileVisibilityToString(ProfileVisibility visibility)
{
    switch (visibility)
    {
    case ProfileVisibility::Public: return "public";
    case ProfileVisibility::Friends: return "friends";
    case ProfileVisibility::Private: return "private";
    default: return "public";
    }
}

inline ProfileVisibility ProfileVisibilityFromString(std::string_view str)
{
    if (str == "friends") return ProfileVisibility::Friends;
    if (str == "private") return ProfileVisibility::Private;
    return ProfileVisibility::Public;
}
}

namespace std
{
template <>
struct hash<lila::shared::domain::UserId>
{
    std::size_t operator()(const lila::shared::domain::UserId& id) const noexcept
    {
        return std::hash<std::int64_t>{}(id.value);
    }
};

template <>
struct hash<lila::shared::domain::MessageId>
{
    std::size_t operator()(const lila::shared::domain::MessageId& id) const noexcept
    {
        return std::hash<std::string>{}(id.value);
    }
};
}
