#pragma once

#include <string>

namespace lila::modules::rooms::presentation
{
struct RoomOpenRequest final
{
    enum class Kind { Create, Join, Restore };

    static RoomOpenRequest Create(
        std::string gameType,
        std::string gameName = {},
        std::string gameSummary = {},
        std::string gameEngine = {},
        int minPlayers = 0,
        int maxPlayers = 0);
    static RoomOpenRequest Join(int roomId, bool spectator);
    static RoomOpenRequest Restore(int roomId);

    Kind kind = Kind::Create;
    std::string gameType;
    std::string gameName;
    std::string gameSummary;
    std::string gameEngine;
    int minPlayers = 0;
    int maxPlayers = 0;
    int roomId = 0;
    bool spectator = false;
};
}
