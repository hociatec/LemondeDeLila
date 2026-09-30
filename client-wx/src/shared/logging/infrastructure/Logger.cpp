#include "shared/logging/application/Logger.h"

#include <chrono>
#include <algorithm>
#include <cctype>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>

namespace lila::shared::logging
{
namespace
{
std::mutex g_logMutex;
constexpr std::size_t MaximumLogMessageBytes = 4096;
constexpr std::string_view Redacted = "[REDACTED]";

std::string Lowercase(std::string_view value)
{
    std::string result(value);
    std::transform(result.begin(), result.end(), result.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return result;
}

void RedactValueAfter(std::string& value, std::size_t markerEnd)
{
    auto begin = value.find_first_not_of(" \t\r\n\":=", markerEnd);
    if (begin == std::string::npos) return;
    const auto end = value.find_first_of(" \t\r\n\",;&", begin);
    value.replace(begin, (end == std::string::npos ? value.size() : end) - begin, Redacted);
}

void RedactAll(std::string& value, std::string_view marker)
{
    std::size_t offset = 0;
    while (offset < value.size())
    {
        const std::string lowered = Lowercase(value);
        const auto position = lowered.find(marker, offset);
        if (position == std::string::npos) break;
        RedactValueAfter(value, position + marker.size());
        offset = position + marker.size() + Redacted.size();
    }
}

std::ofstream& LogFile()
{
    static std::ofstream file("client.log", std::ios::app);
    return file;
}

const char* LevelToString(LogLevel level)
{
    switch (level)
    {
    case LogLevel::Debug:   return "DEBUG";
    case LogLevel::Info:    return "INFO ";
    case LogLevel::Warning: return "WARN ";
    case LogLevel::Error:   return "ERROR";
    default:                return "UNKNOWN";
    }
}
}

std::string SanitizeLogMessage(std::string_view message)
{
    std::string sanitized(message.substr(0, MaximumLogMessageBytes));
    // These markers cover HTTP headers, JSON fields and query parameters.
    // Redaction happens at the logging sink so every caller gets the same
    // protection, including diagnostics originating in WinHTTP exceptions.
    for (const auto marker : {
             std::string_view{"bearer"},
             std::string_view{"authorization"},
             std::string_view{"refreshtoken"},
             std::string_view{"refresh_token"},
             std::string_view{"accesstoken"},
             std::string_view{"access_token"},
             std::string_view{"x-lila-ws-ticket"},
             std::string_view{"ticket"}})
    {
        RedactAll(sanitized, marker);
    }
    if (message.size() > MaximumLogMessageBytes)
    {
        sanitized += "…[TRUNCATED]";
    }
    return sanitized;
}

void Log(LogLevel level, std::string_view category, std::string_view message)
{
    std::lock_guard<std::mutex> lock(g_logMutex);

    auto now = std::chrono::system_clock::now();
    auto timeT = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()) % 1000;

    std::tm tmBuffer{};
#ifdef _WIN32
    localtime_s(&tmBuffer, &timeT);
#else
    localtime_r(&timeT, &tmBuffer);
#endif

    std::ostringstream oss;
    oss << std::put_time(&tmBuffer, "%Y-%m-%d %H:%M:%S")
        << '.' << std::setfill('0') << std::setw(3) << ms.count()
        << " [" << LevelToString(level) << "] [" << category << "] "
        << SanitizeLogMessage(message) << "\n";

    std::string formatted = oss.str();
    std::clog << formatted;

    auto& file = LogFile();
    if (file.is_open())
    {
        file << formatted;
        // Startup failures can terminate the process before the standard
        // stream buffer is written. Keep every diagnostic durable so the
        // launcher can preserve the exact last completed startup step.
        file.flush();
    }
}

void LogDebug(std::string_view category, std::string_view message)
{
    Log(LogLevel::Debug, category, message);
}

void LogInfo(std::string_view category, std::string_view message)
{
    Log(LogLevel::Info, category, message);
}

void LogWarning(std::string_view category, std::string_view message)
{
    Log(LogLevel::Warning, category, message);
}

void LogError(std::string_view category, std::string_view message)
{
    Log(LogLevel::Error, category, message);
}
}
