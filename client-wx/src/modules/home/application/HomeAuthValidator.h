#pragma once

#include <optional>
#include <string>

namespace lila::modules::home::application
{
class HomeAuthValidator final
{
public:
    [[nodiscard]] static std::optional<std::string> ValidateLogin(
        const std::string& username,
        const std::string& password);

    [[nodiscard]] static std::optional<std::string> ValidateRegistration(
        const std::string& username,
        const std::string& email,
        const std::string& password);
};
}
