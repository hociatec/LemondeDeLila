#pragma once

#include <string>

namespace lila::modules::gameplay::domain
{
enum class GameShortcutKind
{
    Unknown,
    Interface,
    Action,
};

enum class GameShortcutActivation
{
    Direct,
    FocusOnly,
};

struct GameShortcut final
{
    std::string rawKey;
    std::string normalizedKey;
    GameShortcutKind kind = GameShortcutKind::Unknown;
    std::string id;
    std::string actionType;
    std::string label;
    GameShortcutActivation activation = GameShortcutActivation::Direct;
};
}
