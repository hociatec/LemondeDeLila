#pragma once

#include <cstdint>
#include <string>
#include <functional>

namespace lila::shared::domain
{
struct UserId
{
    std::int64_t value = 0;

    bool operator==(const UserId& other) const { return value == other.value; }
    bool operator!=(const UserId& other) const { return value != other.value; }
    bool operator<(const UserId& other) const { return value < other.value; }
    [[nodiscard]] bool IsValid() const { return value > 0; }
};

struct MessageId
{
    std::string value;

    bool operator==(const MessageId& other) const { return value == other.value; }
    bool operator!=(const MessageId& other) const { return value != other.value; }
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
