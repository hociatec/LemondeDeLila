#pragma once

#include <string>
#include <vector>

namespace lila::modules::catalog::domain
{
struct CatalogGame final
{
    std::string id;
    std::string name;
    std::string summary;
    std::string engine;
    std::string status;
    int minPlayers = 0;
    int maxPlayers = 0;
    bool chatEnabled = true;
    bool chatSoundsEnabled = true;
    std::vector<std::string> categories;
};

struct CatalogShelf final
{
    std::string id;
    std::string name;
    std::vector<CatalogShelf> children;
    std::vector<CatalogGame> games;
};
}
