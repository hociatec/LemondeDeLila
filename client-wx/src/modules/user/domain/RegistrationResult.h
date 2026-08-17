#pragma once

#include <string>

#include "shared/errors/ErrorMessages.h"

namespace lila::modules::user::domain
{
struct RegistrationResult
{
    bool success = false;
    std::string message;
    std::string username;

    [[nodiscard]] static RegistrationResult Ok(std::string resolvedUsername)
    {
        RegistrationResult result;
        result.success = true;
        result.message = lila::shared::errors::RegistrationSuccessMessage;
        result.username = std::move(resolvedUsername);
        return result;
    }

    [[nodiscard]] static RegistrationResult Fail(std::string error)
    {
        RegistrationResult result;
        result.success = false;
        result.message = std::move(error);
        return result;
    }
};
}
