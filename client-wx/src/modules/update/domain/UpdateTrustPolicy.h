#pragma once

#include <string>

namespace lila::modules::update
{
[[nodiscard]] std::string NormalizeSignerSha256(const std::string& value);
[[nodiscard]] bool SignerSha256Matches(
    const std::string& actual,
    const std::string& expected);
[[nodiscard]] bool IsAuthenticodeTrustAccepted(
    bool trustSucceeded,
    bool onlyChainTrustFailed,
    const std::string& actualSignerSha256,
    const std::string& configuredSignerSha256);
}
