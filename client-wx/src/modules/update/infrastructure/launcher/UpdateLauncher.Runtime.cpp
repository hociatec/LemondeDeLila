#include <fstream>
#include <optional>
#include <stdexcept>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
namespace
{
bool IsOldClientDiagnostic(const fs::path& path)
{
    const auto name = path.filename().wstring();
    return name == L"client.log" || name == L"client-crash.log" ||
        name == L"failed-client.log" || name == L"failed-client-crash.log" ||
        (name.starts_with(L"failed-client-") && name.ends_with(L".log"));
}

void ClearPreservedClientDiagnostics(const fs::path& root) noexcept
{
    try {
        const fs::path stateDirectory = root / L"state";
        if (!fs::is_directory(stateDirectory)) return;
        for (const auto& entry : fs::directory_iterator(stateDirectory)) {
            if (entry.is_regular_file() && IsOldClientDiagnostic(entry.path())) {
                fs::remove(entry.path());
            }
        }
    } catch (...) {
    }
}

void PreserveFailedClientDiagnostics(
    const fs::path& root,
    const std::string& releaseId,
    const std::string& version) noexcept
{
    try {
        ClearPreservedClientDiagnostics(root);
        const fs::path release = ReleasePath(root, releaseId);
        const fs::path sourceLog = release / L"client.log";
        const fs::path sourceCrash = release / L"client-crash.log";
        const fs::path destination = root / L"state" / L"client.log";
        fs::create_directories(destination.parent_path());

        if (fs::is_regular_file(sourceLog)) {
            fs::copy_file(sourceLog, destination, fs::copy_options::overwrite_existing);
            fs::remove(sourceLog);
        }
        if (fs::is_regular_file(sourceCrash)) {
            std::ofstream output(destination, std::ios::app | std::ios::binary);
            std::ifstream input(sourceCrash, std::ios::binary);
            if (!output || !input) throw std::runtime_error("Unable to consolidate client diagnostics.");
            output << "\n--- Crash Windows de la version " << version << " ---\n";
            output << input.rdbuf();
            output.flush();
            if (!output) throw std::runtime_error("Unable to flush client diagnostics.");
            fs::remove(sourceCrash);
        }
        if (fs::is_regular_file(destination)) {
            AppendLog(root, "ERROR", "Preserved the latest client diagnostic in state\\client.log.");
        }
    } catch (...) {
    }
}
}

int RunLauncher(bool skipLauncherReplacement)
{
    HANDLE mutex = CreateMutexW(nullptr, TRUE, LauncherMutex);
    if (!mutex || GetLastError() == ERROR_ALREADY_EXISTS) {
        if (mutex) CloseHandle(mutex);
        return 0;
    }
    const fs::path root = ExecutablePath().parent_path();
    ClearPreservedClientDiagnostics(root);
    State state = ReadState(root);
    AdoptBundledVersion(root, state);
    CleanupStaging(root);
    CleanupOldVersions(root, state);
    if (!skipLauncherReplacement && RestartForLauncherUpdate(root, state)) return 0;

    std::optional<Manifest> pending;
    std::string startupUpdateFailure;
    UpdateProgressDialog startupProgress;
    try {
        auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
        RecordSignedPolicy(root, state, manifest);
        if (manifest.releaseId != state.failedReleaseId &&
            IsUpdateNewer(manifest.version, state.currentVersion)) {
            startupProgress.Show(manifest.version);
            PrepareRelease(root, manifest, &startupProgress);
            pending = std::move(manifest);
        }
    } catch (const std::exception& error) {
        startupProgress.Close();
        startupUpdateFailure = error.what();
        AppendLog(root, "WARN", "Startup update check failed: " + startupUpdateFailure);
    }
    if (pending) {
        ActivateRelease(root, state, *pending);
        startupProgress.SetStage(L"Démarrage du client…", 100);
        AppendLog(root, "INFO", "Activated update " + pending->version + ".");
        if (RestartForLauncherUpdate(root, state)) return 0;
    }
    startupProgress.Close();
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
            DWORD exitCode = STILL_ACTIVE;
            static_cast<void>(GetExitCodeProcess(process.handle, &exitCode));
            if (exitCode == STILL_ACTIVE) {
                TerminateProcess(process.handle, 0x4C494C41);
                WaitForSingleObject(process.handle, 5000);
            }
            AppendLog(root, "ERROR",
                "Client health check failed for " + state.currentVersion +
                " (exit code " + std::to_string(exitCode) + ").");
            PreserveFailedClientDiagnostics(root, state.currentReleaseId, state.currentVersion);
            if (state.previousReleaseId.empty()) {
                throw std::runtime_error(
                    "Client failed its startup health check. Diagnostic: state\\client.log");
            }
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
        ClearPreservedClientDiagnostics(root);

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
