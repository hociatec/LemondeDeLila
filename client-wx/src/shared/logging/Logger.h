#pragma once

#include <string>
#include <string_view>
#include <system_error>

namespace lila::shared::logging
{
enum class LogLevel
{
    Debug,
    Info,
    Warning,
    Error
};

void Log(LogLevel level, std::string_view category, std::string_view message);
void LogDebug(std::string_view category, std::string_view message);
void LogInfo(std::string_view category, std::string_view message);
void LogWarning(std::string_view category, std::string_view message);
void LogError(std::string_view category, std::string_view message);
}

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
    AppError(ErrorCode code, std::string userMessage, std::string diagnosticDetails = "")
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
}
