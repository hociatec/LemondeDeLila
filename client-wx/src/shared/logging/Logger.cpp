#include "shared/logging/Logger.h"

#include <chrono>
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
        << message << "\n";

    std::string formatted = oss.str();
    std::clog << formatted;

    auto& file = LogFile();
    if (file.is_open())
    {
        file << formatted;
        if (level == LogLevel::Warning || level == LogLevel::Error)
        {
            file.flush();
        }
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
