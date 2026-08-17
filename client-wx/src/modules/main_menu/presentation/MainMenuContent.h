#pragma once

#include <span>
#include <string_view>

namespace lila::modules::main_menu::presentation
{
enum class MainMenuAction
{
    OpenCatalog,
    OpenChat,
    OpenSocial,
    OpenAbout,
    OpenOptions,
    Logout,
};

struct MainMenuEntry
{
    MainMenuAction action;
    std::wstring_view label;
    std::wstring_view statusMessage;
};

[[nodiscard]] std::span<const MainMenuEntry> GetMainMenuEntries();
}
