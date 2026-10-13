#include "modules/shortcuts/domain/Shortcut.h"
#include <algorithm>
#include <regex>
#include <set>

namespace lila::modules::shortcuts::domain
{
bool ValidChord(const std::string& chord)
{
    static const std::regex pattern(R"(^(CTRL|ALT)\+SHIFT\+([A-Z0-9]|F[1-9]|F1[0-2])$)");
    return std::regex_match(chord, pattern) && chord != "CTRL+SHIFT+C" &&
        chord != "CTRL+SHIFT+V" && chord != "CTRL+SHIFT+X" && chord != "CTRL+SHIFT+Z";
}
std::vector<ShortcutTarget> FunctionTargets(bool admin)
{
    std::vector<ShortcutTarget> targets{
        {"main_menu", "Menu principal"}, {"catalog", "Catalogue des jeux"},
        {"chat", "Tchat"}, {"messaging", "Messagerie"}, {"inbox", "Boîte de réception"},
        {"social", "Amis et contacts"}, {"leaderboard", "Classement"},
        {"vault", "Mon coffre fort"}, {"options", "Options"}, {"contact", "Contacter un administrateur"},
        {"shortcuts", "Gestionnaire de raccourcis"}, {"return_table", "Retour à ma table"}};
    if (admin) targets.push_back({"admin", "Administration"});
    return targets;
}
std::string Validate(const std::vector<Shortcut>& items)
{
    if (items.size() > 50) return "Maximum 50 raccourcis.";
    const auto functions = FunctionTargets(true);
    static const std::regex game(R"(^game:[a-z0-9][a-z0-9_-]{0,95}$)");
    std::set<std::string> chords;
    for (const auto& item : items)
    {
        if (item.label.empty() || item.label.size() > 480) return "Nom de raccourci invalide.";
        if (!ValidChord(item.chord)) return "Combinaison réservée ou invalide. Utilisez Ctrl+Maj ou Alt+Maj avec une lettre, un chiffre ou F1 à F12.";
        if (!chords.insert(item.chord).second) return "Cette combinaison est déjà attribuée à un autre raccourci.";
        if (!std::regex_match(item.target, game) && std::none_of(functions.begin(), functions.end(),
            [&](const auto& target) { return target.id == item.target; })) return "Destination inconnue.";
    }
    return {};
}
}
