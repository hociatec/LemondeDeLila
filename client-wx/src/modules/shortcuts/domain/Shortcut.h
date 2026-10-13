#pragma once
#include <string>
#include <vector>

namespace lila::modules::shortcuts::domain
{
struct Shortcut
{
    std::string target;
    std::string label;
    std::string chord;
    bool enabled = true;
};
struct ShortcutSnapshot
{
    int revision = 0;
    std::vector<Shortcut> items;
    bool synchronized = false;
};
struct ShortcutTarget { std::string id; std::string label; };
[[nodiscard]] bool ValidChord(const std::string& chord);
[[nodiscard]] std::string Validate(const std::vector<Shortcut>& items);
[[nodiscard]] std::vector<ShortcutTarget> FunctionTargets(bool admin);
}
