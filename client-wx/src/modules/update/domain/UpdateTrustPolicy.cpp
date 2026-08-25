#include "modules/update/domain/UpdateTrustPolicy.h"

#include <cctype>

namespace lila::modules::update
{
std::string NormalizeSignerSha256(const std::string& value)
{
    std::string result;
    result.reserve(value.size());
    for (const unsigned char character : value) {
        if (std::isxdigit(character)) {
            result.push_back(static_cast<char>(std::tolower(character)));
        } else if (character != ':' && character != '-' && !std::isspace(character)) {
            return {};
        }
    }
    return result.size() == 64 ? result : std::string{};
}

bool SignerSha256Matches(const std::string& actual, const std::string& expected)
{
    const auto normalizedActual = NormalizeSignerSha256(actual);
    const auto normalizedExpected = NormalizeSignerSha256(expected);
    if (normalizedActual.empty() || normalizedExpected.empty() ||
        normalizedActual.size() != normalizedExpected.size()) return false;
    unsigned char difference = 0;
    for (std::size_t index = 0; index < normalizedActual.size(); ++index) {
        difference |= static_cast<unsigned char>(
            normalizedActual[index] ^ normalizedExpected[index]);
    }
    return difference == 0;
}

bool IsAuthenticodeTrustAccepted(
    bool trustSucceeded,
    bool onlyChainTrustFailed,
    const std::string& actualSignerSha256,
    const std::string& configuredSignerSha256)
{
    const bool pinConfigured = !configuredSignerSha256.empty();
    const bool validPin = !NormalizeSignerSha256(configuredSignerSha256).empty();
    const bool signerPinned = validPin &&
        SignerSha256Matches(actualSignerSha256, configuredSignerSha256);
    return (trustSucceeded && (!pinConfigured || signerPinned)) ||
        (onlyChainTrustFailed && signerPinned);
}
}
