#include "modules/main_menu/presentation/MainMenuContent.h"

#include <array>

namespace lila::modules::main_menu::presentation
{
namespace
{
constexpr std::array<MainMenuEntry, 6> MenuEntries = {{
    {MainMenuAction::OpenCatalog, L"Entrée dans la taverne", L"Le catalogue de jeux n'est pas encore connecté dans le client natif."},
    {MainMenuAction::OpenChat, L"Chat", L"Ouvrir le module de tchat du client natif."},
    {MainMenuAction::OpenSocial, L"Social", L"Ouvrir le module social du client natif."},
    {MainMenuAction::OpenAbout, L"À propos", L"Ouvrir l'écran d'informations du client natif."},
    {MainMenuAction::OpenOptions, L"Options", L"Ouvrir l'écran de configuration du client natif."},
    {MainMenuAction::Logout, L"Se déconnecter", L"Quitter le menu principal et revenir à l'écran de connexion."},
}};
}

std::span<const MainMenuEntry> GetMainMenuEntries()
{
    return MenuEntries;
}
}
