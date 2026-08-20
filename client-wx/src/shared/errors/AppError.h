#pragma once

#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include "shared/errors/CoreErrorMessages.h"

namespace lila::shared::errors
{
enum class ErrorCode
{
    Success = 0,
    Unexpected,
    InvalidSession,
    SessionExpired,
    NoActiveSession,
    InvalidOptions,
    JsonCorrupted,
    NetworkError,
    HttpError,
    WebSocketError,
    AuthenticationFailed,
    RegistrationFailed,
    Unauthorized,
    NotFound,
    Timeout
};

class AppError
{
public:
    AppError() = default;
    AppError(ErrorCode code, std::string userMessage, std::string diagnosticDetails = {})
        : code_(code), userMessage_(std::move(userMessage)), diagnosticDetails_(std::move(diagnosticDetails)) {}

    [[nodiscard]] ErrorCode Code() const { return code_; }
    [[nodiscard]] const std::string& UserMessage() const { return userMessage_; }
    [[nodiscard]] const std::string& DiagnosticDetails() const { return diagnosticDetails_; }
    [[nodiscard]] bool HasError() const { return code_ != ErrorCode::Success; }

private:
    ErrorCode code_ = ErrorCode::Success;
    std::string userMessage_;
    std::string diagnosticDetails_;
};

template <typename T>
class Result
{
public:
    Result(T value) : value_(std::move(value)), isSuccess_(true) {}
    Result(AppError error) : error_(std::move(error)), isSuccess_(false) {}

    [[nodiscard]] bool IsSuccess() const { return isSuccess_; }
    [[nodiscard]] bool IsError() const { return !isSuccess_; }

    [[nodiscard]] const T& Value() const { return value_; }
    [[nodiscard]] T& Value() { return value_; }
    [[nodiscard]] const AppError& Error() const { return error_; }

private:
    T value_{};
    AppError error_;
    bool isSuccess_ = false;
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
    ErrorCode code,
    std::string userMessage,
    std::string diagnosticDetails = {})
{
    return AppError(code, std::move(userMessage), std::move(diagnosticDetails));
}

[[nodiscard]] inline AppError ToAppError(const std::exception& exception, std::string_view fallbackUserMessage = UnexpectedError)
{
    if (const auto* appException = dynamic_cast<const AppException*>(&exception))
    {
        return appException->Error();
    }

    return AppError(ErrorCode::Unexpected, std::string(fallbackUserMessage), exception.what());
}

[[nodiscard]] inline std::string DiagnosticMessage(const std::exception& exception)
{
    return ToAppError(exception).DiagnosticDetails();
}
}
