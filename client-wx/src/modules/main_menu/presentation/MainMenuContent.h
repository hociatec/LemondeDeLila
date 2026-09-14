#pragma once

#include <span>
#include <string_view>
#include <vector>

namespace lila::modules::main_menu::presentation
{
enum class MainMenuAction
{
    OpenCatalog,
    OpenChat,
    OpenSocial,
    OpenAbout,
    OpenOptions,
    OpenAdmin,
    Logout,
};

struct MainMenuEntry
{
    MainMenuAction action;
    std::wstring_view label;
    std::wstring_view statusMessage;
};

[[nodiscard]] std::vector<MainMenuEntry> GetMainMenuEntries(bool includeAdmin);
}
