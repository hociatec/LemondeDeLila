#pragma once

#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include "shared/errors/catalog/CoreErrorMessages.h"

namespace lila::shared::errors
{
class AppError
{
public:
    AppError(std::string userMessage, std::string diagnosticDetails = {})
        : userMessage_(std::move(userMessage)), diagnosticDetails_(std::move(diagnosticDetails)) {}

    [[nodiscard]] const std::string& UserMessage() const { return userMessage_; }
    [[nodiscard]] const std::string& DiagnosticDetails() const { return diagnosticDetails_; }

private:
    std::string userMessage_;
    std::string diagnosticDetails_;
};

class AppException final : public std::runtime_error
{
public:
    explicit AppException(AppError error)
        : std::runtime_error(error.DiagnosticDetails().empty() ? error.UserMessage() : error.DiagnosticDetails()),
          error_(std::move(error))
    {
    }

    [[nodiscard]] const AppError& Error() const noexcept
    {
        return error_;
    }

private:
    AppError error_;
};

[[nodiscard]] inline AppError ToAppError(
    std::string userMessage,
    std::string diagnosticDetails = {})
{
    return AppError(std::move(userMessage), std::move(diagnosticDetails));
}

[[nodiscard]] inline AppError ToAppError(const std::exception& exception, std::string_view fallbackUserMessage = UnexpectedError)
{
    if (const auto* appException = dynamic_cast<const AppException*>(&exception))
    {
        return appException->Error();
    }

    return AppError(std::string(fallbackUserMessage), exception.what());
}
}
