#pragma once

#include <string_view>

namespace lila::shared::network {

struct NetworkTimeouts final
{
    static constexpr int ResolveAndConnectMs = 10'000;
    static constexpr int SendMs = 15'000;
    static constexpr int ReceiveMs = 30'000;
};

inline constexpr std::string_view UserAgent = "LeMondeDeLilaWX/0.1";

}
