#include <optional>
#include <stdexcept>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
int RunLauncher(bool skipLauncherReplacement)
{
    HANDLE mutex = CreateMutexW(nullptr, TRUE, LauncherMutex);
    if (!mutex || GetLastError() == ERROR_ALREADY_EXISTS) {
        if (mutex) CloseHandle(mutex);
        return 0;
    }
    const fs::path root = ExecutablePath().parent_path();
    State state = ReadState(root);
    AdoptBundledVersion(root, state);
    CleanupStaging(root);
    CleanupOldVersions(root, state);
    if (!skipLauncherReplacement && RestartForLauncherUpdate(root, state)) return 0;

    std::optional<Manifest> pending;
    std::string startupUpdateFailure;
    try {
        auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
        RecordSignedPolicy(root, state, manifest);
        if (manifest.releaseId != state.failedReleaseId &&
            IsUpdateNewer(manifest.version, state.currentVersion)) {
            PrepareRelease(root, manifest);
            pending = std::move(manifest);
        }
    } catch (const std::exception& error) {
        startupUpdateFailure = error.what();
        AppendLog(root, "WARN", "Startup update check failed: " + startupUpdateFailure);
    }
    if (pending) {
        ActivateRelease(root, state, *pending);
        AppendLog(root, "INFO", "Activated update " + pending->version + ".");
        if (RestartForLauncherUpdate(root, state)) return 0;
    }
    if (state.currentReleaseId.empty()) throw std::runtime_error("No installed client version.");
    if (!LocalVersionIsAllowed(state)) {
        std::string message =
            "La mise a jour obligatoire vers la version " + state.requiredVersion +
            " n'a pas pu etre installee.";
        if (!startupUpdateFailure.empty()) {
            message += "\n\nCause : " + startupUpdateFailure;
        }
        message += "\n\nLe lanceur reessaiera au prochain demarrage. Journal :\n" +
            Narrow((root / L"state" / L"update.log").wstring());
        throw std::runtime_error(message);
    }

    while (true) {
        Process process = LaunchClient(ReleasePath(root, state.currentReleaseId));
        if (!WaitForHealthy(process)) {
            if (state.previousReleaseId.empty()) throw std::runtime_error("Client failed its startup health check.");
            TerminateProcess(process.handle, 0x4C494C41);
            WaitForSingleObject(process.handle, 5000);
            state.failedReleaseId = state.currentReleaseId;
            state.failedVersion = state.currentVersion;
            state.currentReleaseId = state.previousReleaseId;
            state.currentVersion = state.previousVersion;
            state.previousReleaseId.clear();
            state.previousVersion.clear();
            SaveState(root, state);
            CleanupOldVersions(root, state);
            AppendLog(root, "ERROR", "Rolled back failed release " + state.failedReleaseId + ".");
            continue;
        }
        if (!state.previousReleaseId.empty()) {
            state.retainedReleaseId = state.previousReleaseId;
            state.previousReleaseId.clear();
            state.previousVersion.clear();
            SaveState(root, state);
            CleanupOldVersions(root, state);
        }
        AppendLog(root, "INFO", "Client health check succeeded for " + state.currentVersion + ".");

        bool restartingForUpdate = false;
        while (WaitForSingleObject(process.handle, static_cast<DWORD>(PollInterval.count() * 1000)) == WAIT_TIMEOUT) {
            try {
                auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
                RecordSignedPolicy(root, state, manifest);
                if (manifest.releaseId == state.failedReleaseId ||
                    !IsUpdateNewer(manifest.version, state.currentVersion)) continue;
                PrepareRelease(root, manifest);
                StopForUpdate(process);
                ActivateRelease(root, state, manifest);
                restartingForUpdate = true;
                AppendLog(root, "INFO", "Activated live update " + manifest.version + ".");
                if (RestartForLauncherUpdate(root, state)) return 0;
                break;
            } catch (const std::exception& error) {
                AppendLog(root, "WARN", std::string("Live update check failed: ") + error.what());
            }
        }
        if (!restartingForUpdate && WaitForSingleObject(process.handle, 0) == WAIT_OBJECT_0) return 0;
    }
}

}
