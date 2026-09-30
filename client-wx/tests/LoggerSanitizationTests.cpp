#include <cassert>
#include <iostream>
#include <string>

#include "shared/logging/application/Logger.h"

int main()
{
    const std::string secret = "secret-value-123";
    const auto sanitized = lila::shared::logging::SanitizeLogMessage(
        "Authorization: Bearer " + secret
        + " {\"refreshToken\":\"" + secret
        + "\",\"ticket\":\"" + secret + "\"}");
    assert(sanitized.find(secret) == std::string::npos);
    assert(sanitized.find("[REDACTED]") != std::string::npos);

    const std::string oversized(5000, 'x');
    assert(lila::shared::logging::SanitizeLogMessage(oversized).size() < oversized.size());

    std::cout << "Logger sanitization tests passed.\n";
}
