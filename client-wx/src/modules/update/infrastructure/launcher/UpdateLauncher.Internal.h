#pragma once

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <string>

#include "modules/update/domain/UpdateProtocol.h"

namespace lila::modules::update::launcher
{
namespace fs = std::filesystem;
using Manifest = lila::modules::update::UpdateManifest;
using lila::modules::update::BuildStagedUpdateArchiveFileName;
using lila::modules::update::CanonicalUpdateSignature;
using lila::modules::update::IsSafeReleaseId;
using lila::modules::update::IsUpdateNewer;
using lila::modules::update::ParseUpdateManifest;
using lila::modules::update::ParseUpdateVersion;

inline constexpr wchar_t AppExecutable[] = L"lemonde_de_lila_wx.exe";
inline constexpr wchar_t LauncherExecutable[] = L"lila_launcher.exe";
inline constexpr wchar_t LauncherMutex[] = L"Local\\LeMondeDeLilaWX.Launcher";
inline constexpr auto PollInterval = std::chrono::seconds(120);
inline constexpr std::uint64_t MinimumFreeSpaceReserve = 128ULL * 1024ULL * 1024ULL;
inline constexpr std::uint64_t MaximumArchiveEntries = 20'000;
inline constexpr std::uint64_t MaximumExtractedBytes = 8ULL * 1024ULL * 1024ULL * 1024ULL;

struct State
{
    std::string currentVersion;
    std::string currentReleaseId;
    std::string previousVersion;
    std::string previousReleaseId;
    std::string retainedReleaseId;
    std::string failedReleaseId;
    std::string failedVersion;
    std::string requiredVersion;
    std::uint64_t highestSequence = 0;
};

struct Process
{
    HANDLE handle = nullptr;
    DWORD id = 0;
    ~Process();
    Process() = default;
    Process(const Process&) = delete;
    Process& operator=(const Process&) = delete;
    Process(Process&& other) noexcept;
    Process& operator=(Process&& other) noexcept;
};

enum class LauncherReplacement { NotNeeded, Spawned, Failed };

std::wstring Widen(const std::string& value);
std::string Narrow(const std::wstring& value);
std::string Environment(const wchar_t* name);
bool AllowUnsignedUpdates();
fs::path ExecutablePath();
fs::path ReleasePath(const fs::path& root, const std::string& releaseId);
void AppendLog(const fs::path& root, const char* level, const std::string& message) noexcept;
State ReadState(const fs::path& root);
void SaveState(const fs::path& root, const State& state);
bool DeadlineReached(const std::string& value);
std::string RequiredVersion(const Manifest& manifest);
std::string DownloadText(const std::string& url);
void DownloadFile(const std::string& url, const fs::path& destination, std::uint64_t expectedBytes);
std::string Sha256(const fs::path& path);
bool VerifyAuthenticode(const fs::path& executable, std::string* failureReason = nullptr);
bool VerifyManifestSignature(const Manifest& manifest);
Manifest ParseManifest(const std::string& raw);
std::string ManifestUrl(const std::string& currentVersion);
fs::path PrepareRelease(const fs::path& root, const Manifest& manifest);
Process LaunchClient(const fs::path& directory);
bool WaitForHealthy(const Process& process);
void StopForUpdate(Process& process);
LauncherReplacement SpawnLauncherReplacement(const fs::path& candidate, const fs::path& target);
int ReplaceLauncher(DWORD parentProcessId, const fs::path& target);
void AdoptBundledVersion(const fs::path& root, State& state);
void CleanupStaging(const fs::path& root) noexcept;
void CleanupOldVersions(const fs::path& root, const State& state) noexcept;
bool RestartForLauncherUpdate(const fs::path& root, const State& state);
void RecordSignedPolicy(const fs::path& root, State& state, const Manifest& manifest);
bool LocalVersionIsAllowed(const State& state);
void ActivateRelease(const fs::path& root, State& state, const Manifest& manifest);
int RunLauncher(bool skipLauncherReplacement);
}
