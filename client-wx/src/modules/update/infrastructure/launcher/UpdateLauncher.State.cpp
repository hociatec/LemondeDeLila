#include <nlohmann/json.hpp>

#include <fstream>
#include <iomanip>
#include <stdexcept>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
using json = nlohmann::json;

fs::path StatePath(const fs::path& root) { return root / L"state" / L"current.json"; }
fs::path ReleasePath(const fs::path& root, const std::string& releaseId)
{
    if (!IsSafeReleaseId(releaseId)) throw std::runtime_error("Unsafe update release identifier.");
    const fs::path versions = fs::weakly_canonical(root) / L"versions";
    const fs::path candidate = versions / Widen(releaseId);
    if (candidate.parent_path().lexically_normal() != versions.lexically_normal()) {
        throw std::runtime_error("Update release path escaped its root.");
    }
    return candidate;
}

void AppendLog(const fs::path& root, const char* level, const std::string& message) noexcept
{
    try {
        fs::create_directories(root / L"state");
        const fs::path logPath = root / L"state" / L"update.log";
        if (fs::exists(logPath) && fs::file_size(logPath) > 5ULL * 1024ULL * 1024ULL) {
            const fs::path previous = root / L"state" / L"update.log.1";
            fs::remove(previous);
            fs::rename(logPath, previous);
        }
        SYSTEMTIME now{};
        GetSystemTime(&now);
        std::ofstream output(logPath, std::ios::app | std::ios::binary);
        output << std::setfill('0') << std::setw(4) << now.wYear << '-'
            << std::setw(2) << now.wMonth << '-' << std::setw(2) << now.wDay << 'T'
            << std::setw(2) << now.wHour << ':' << std::setw(2) << now.wMinute << ':'
            << std::setw(2) << now.wSecond << 'Z' << " [" << level << "] " << message << '\n';
    } catch (...) {
    }
}

void WriteTextAtomic(const fs::path& path, const std::string& text)
{
    fs::create_directories(path.parent_path());
    const fs::path temporary = path.wstring() + L".tmp";
    {
        std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
        if (!output) throw std::runtime_error("Unable to write updater state.");
        output.write(text.data(), static_cast<std::streamsize>(text.size()));
        output.flush();
        if (!output) throw std::runtime_error("Unable to flush updater state.");
    }
    const fs::path backup = path.wstring() + L".bak";
    DeleteFileW(backup.c_str());
    const BOOL committed = fs::exists(path)
        ? ReplaceFileW(path.c_str(), temporary.c_str(), backup.c_str(),
              REPLACEFILE_WRITE_THROUGH, nullptr, nullptr)
        : MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_WRITE_THROUGH);
    if (!committed) {
        DeleteFileW(temporary.c_str());
        throw std::runtime_error("Unable to commit updater state.");
    }
}

State ReadState(const fs::path& root)
{
    State state;
    auto read = [&state](const fs::path& path) {
        std::ifstream input(path, std::ios::binary);
        if (!input) return false;
        const auto value = json::parse(input);
        state.currentVersion = value.value("currentVersion", "");
        state.currentReleaseId = value.value("currentReleaseId", "");
        state.previousVersion = value.value("previousVersion", "");
        state.previousReleaseId = value.value("previousReleaseId", "");
        state.retainedReleaseId = value.value("retainedReleaseId", "");
        state.failedReleaseId = value.value("failedReleaseId", "");
        state.failedVersion = value.value("failedVersion", "");
        state.requiredVersion = value.value("requiredVersion", "");
        state.highestSequence = value.value("highestSequence", std::uint64_t{});
        return true;
    };
    try {
        if (!read(StatePath(root))) return state;
    } catch (...) {
        try {
            if (!read(StatePath(root).wstring() + L".bak")) {
                throw std::runtime_error("Updater state is corrupted.");
            }
            AppendLog(root, "WARN", "Recovered updater state from backup.");
        } catch (...) {
            throw std::runtime_error("Updater state and backup are corrupted.");
        }
    }
    return state;
}

void SaveState(const fs::path& root, const State& state)
{
    WriteTextAtomic(StatePath(root), json{
        {"schemaVersion", 1},
        {"currentVersion", state.currentVersion},
        {"currentReleaseId", state.currentReleaseId},
        {"previousVersion", state.previousVersion},
        {"previousReleaseId", state.previousReleaseId},
        {"retainedReleaseId", state.retainedReleaseId},
        {"failedReleaseId", state.failedReleaseId},
        {"failedVersion", state.failedVersion},
        {"requiredVersion", state.requiredVersion},
        {"highestSequence", state.highestSequence},
    }.dump(2));
}

bool DeadlineReached(const std::string& value)
{
    if (value.empty()) return false;
    SYSTEMTIME deadline{};
    int milliseconds = 0;
    if (sscanf_s(value.c_str(), "%hu-%hu-%huT%hu:%hu:%hu.%dZ",
            &deadline.wYear, &deadline.wMonth, &deadline.wDay,
            &deadline.wHour, &deadline.wMinute, &deadline.wSecond,
            &milliseconds) != 7 || milliseconds < 0 || milliseconds > 999) {
        throw std::runtime_error("Invalid mandatory update date.");
    }
    deadline.wMilliseconds = static_cast<WORD>(milliseconds);
    FILETIME deadlineFileTime{};
    FILETIME now{};
    if (!SystemTimeToFileTime(&deadline, &deadlineFileTime)) {
        throw std::runtime_error("Invalid mandatory update date.");
    }
    GetSystemTimeAsFileTime(&now);
    return CompareFileTime(&now, &deadlineFileTime) >= 0;
}

std::string RequiredVersion(const Manifest& manifest)
{
    std::string required = manifest.minimumVersion;
    if (DeadlineReached(manifest.mandatoryAt) &&
        (required.empty() || IsUpdateNewer(manifest.version, required))) {
        required = manifest.version;
    }
    return required;
}
}
