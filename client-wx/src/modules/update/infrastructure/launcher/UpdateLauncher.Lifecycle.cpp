#include <optional>
#include <stdexcept>
#include <string_view>

#include "UpdateBuildConfig.h"
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
void AdoptBundledVersion(const fs::path& root, State& state)
{
    const fs::path bundled = root / L"app";
    if (!fs::is_regular_file(bundled / AppExecutable) ||
        !fs::is_regular_file(bundled / LauncherExecutable)) return;

    const std::string bundledVersion = lila::modules::update::UpdateBuildConfig::BuildVersion;
    if (!state.currentVersion.empty() &&
        IsUpdateNewer(state.currentVersion, bundledVersion)) {
        fs::remove_all(bundled);
        return;
    }

    const std::string bundledReleaseId = "installer-" + bundledVersion;
    const auto destination = ReleasePath(root, bundledReleaseId);
    fs::create_directories(destination.parent_path());
    if (fs::exists(destination)) fs::remove_all(destination);
    fs::rename(bundled, destination);

    if (!state.currentReleaseId.empty() && state.currentReleaseId != bundledReleaseId) {
        state.previousVersion = state.currentVersion;
        state.previousReleaseId = state.currentReleaseId;
    } else {
        state.previousVersion.clear();
        state.previousReleaseId.clear();
    }
    state.currentVersion = bundledVersion;
    state.currentReleaseId = bundledReleaseId;
    state.failedReleaseId.clear();
    state.failedVersion.clear();
    SaveState(root, state);
    AppendLog(root, "INFO", "Adopted installer version " + bundledVersion + ".");
}

void CleanupStaging(const fs::path& root) noexcept
{
    try {
        const fs::path staging = root / L"staging";
        if (!fs::is_directory(staging)) return;
        std::optional<fs::directory_entry> newestArchive;
        for (const auto& entry : fs::directory_iterator(staging)) {
            const std::string name = Narrow(entry.path().filename().wstring());
            static constexpr std::string_view suffix = ".download.zip";
            const bool resumableArchive = entry.is_regular_file() &&
                name.ends_with(suffix) &&
                IsSafeReleaseId(name.substr(0, name.size() - suffix.size()));
            if (!resumableArchive) {
                fs::remove_all(entry.path());
                continue;
            }
            if (!newestArchive ||
                entry.last_write_time() > newestArchive->last_write_time()) {
                if (newestArchive) fs::remove(newestArchive->path());
                newestArchive = entry;
            } else {
                fs::remove(entry.path());
            }
        }
    } catch (...) {
    }
}

void CleanupOldVersions(const fs::path& root, const State& state) noexcept
{
    try {
        const fs::path versions = root / L"versions";
        if (!fs::is_directory(versions)) return;
        for (const auto& entry : fs::directory_iterator(versions)) {
            if (!entry.is_directory()) continue;
            const auto id = Narrow(entry.path().filename().wstring());
            if (id == state.currentReleaseId || id == state.previousReleaseId ||
                id == state.retainedReleaseId) continue;
            if (IsSafeReleaseId(id) && entry.path().parent_path() == versions) {
                fs::remove_all(entry.path());
            }
        }
    } catch (...) {
    }
}

bool RestartForLauncherUpdate(const fs::path& root, const State& state)
{
    if (state.currentReleaseId.empty()) return false;
    const auto candidate = ReleasePath(root, state.currentReleaseId) / LauncherExecutable;
    const auto replacement = SpawnLauncherReplacement(candidate, ExecutablePath());
    if (replacement == LauncherReplacement::Spawned) return true;
    if (replacement == LauncherReplacement::Failed) {
        AppendLog(root, "WARN", "Launcher replacement could not be started; it will be retried.");
    }
    return false;
}

void RecordSignedPolicy(const fs::path& root, State& state, const Manifest& manifest)
{
    if (manifest.sequence < state.highestSequence) {
        throw std::runtime_error("Update manifest sequence attempted a downgrade.");
    }
    bool changed = false;
    if (manifest.sequence > state.highestSequence) {
        state.highestSequence = manifest.sequence;
        changed = true;
    }
    const auto required = RequiredVersion(manifest);
    if (!required.empty() &&
        (state.requiredVersion.empty() || IsUpdateNewer(required, state.requiredVersion))) {
        state.requiredVersion = required;
        changed = true;
    }
    if (changed) SaveState(root, state);
}

bool LocalVersionIsAllowed(const State& state)
{
    if (state.requiredVersion.empty() ||
        !IsUpdateNewer(state.requiredVersion, state.currentVersion)) return true;
    return !state.failedVersion.empty() &&
        !IsUpdateNewer(state.requiredVersion, state.failedVersion);
}

void ActivateRelease(const fs::path& root, State& state, const Manifest& manifest)
{
    state.previousVersion = state.currentVersion;
    state.previousReleaseId = state.currentReleaseId;
    state.currentVersion = manifest.version;
    state.currentReleaseId = manifest.releaseId;
    SaveState(root, state);
}
}
