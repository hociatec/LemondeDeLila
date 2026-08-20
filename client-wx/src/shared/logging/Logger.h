#pragma once

#include <string>
#include <string_view>

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
