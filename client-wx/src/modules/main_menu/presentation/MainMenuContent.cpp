#include "modules/main_menu/presentation/MainMenuContent.h"

#include <vector>

namespace lila::modules::main_menu::presentation
{
namespace
{
constexpr MainMenuEntry Catalog{MainMenuAction::OpenCatalog, L"Entrée dans la taverne", L"Ouvrir les étagères du catalogue."};
constexpr MainMenuEntry Chat{MainMenuAction::OpenChat, L"Chat", L"Ouvrir le module de tchat du client natif."};
constexpr MainMenuEntry Social{MainMenuAction::OpenSocial, L"Social", L"Ouvrir le module social du client natif."};
constexpr MainMenuEntry Admin{MainMenuAction::OpenAdmin, L"Administration", L"Ouvrir la console d'administration."};
constexpr MainMenuEntry About{MainMenuAction::OpenAbout, L"À propos", L"Ouvrir l'écran d'informations du client natif."};
constexpr MainMenuEntry Options{MainMenuAction::OpenOptions, L"Options", L"Ouvrir l'écran de configuration du client natif."};
constexpr MainMenuEntry Logout{MainMenuAction::Logout, L"Se déconnecter", L"Quitter le menu principal et revenir à l'écran de connexion."};
}

std::vector<MainMenuEntry> GetMainMenuEntries(bool includeAdmin)
{
    std::vector<MainMenuEntry> entries{Catalog, Chat, Social};
    if (includeAdmin) entries.push_back(Admin);
    entries.insert(entries.end(), {About, Options, Logout});
    return entries;
}
}
