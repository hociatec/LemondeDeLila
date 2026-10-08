#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

#include <stdexcept>

namespace lila::modules::update::launcher
{
namespace
{
class ScopedHandle final
{
public:
    explicit ScopedHandle(HANDLE handle) noexcept : handle_(handle) {}
    ~ScopedHandle() { if (handle_) CloseHandle(handle_); }
    ScopedHandle(const ScopedHandle&) = delete;
    ScopedHandle& operator=(const ScopedHandle&) = delete;

private:
    HANDLE handle_ = nullptr;
};

bool NewerReleaseAvailable(const State& state)
{
    try {
        const auto manifest = ParseManifest(DownloadText(ManifestUrl(state.currentVersion)));
        return IsUpdateNewer(manifest.version, state.currentVersion);
    } catch (...) {
        return false;
    }
}
}

bool SecondaryLaunchersActive()
{
    HANDLE signal = OpenEventW(SYNCHRONIZE, FALSE, SecondaryLaunchersSignalName);
    if (!signal) return false;
    CloseHandle(signal);
    return true;
}

int RunSecondaryLauncher(const fs::path& root, HANDLE updateCheckSignal)
{
    State state = ReadState(root);
    if (NewerReleaseAvailable(state)) {
        if (!SetEvent(updateCheckSignal))
            throw std::runtime_error("Unable to request an immediate update check.");
        AppendLog(root, "INFO", "Secondary launch requested an immediate update check.");
        return 0;
    }

    HANDLE signal = CreateEventW(nullptr, TRUE, TRUE, SecondaryLaunchersSignalName);
    if (!signal) throw std::runtime_error("Unable to register secondary launcher.");
    ScopedHandle activeSignal(signal);
    if (state.currentReleaseId.empty() || !LocalVersionIsAllowed(state))
        throw std::runtime_error("No allowed client version is installed.");

    Process process = LaunchClient(ReleasePath(root, state.currentReleaseId), false);
    if (!WaitForHealthy(process)) {
        DWORD exitCode = STILL_ACTIVE;
        static_cast<void>(GetExitCodeProcess(process.handle, &exitCode));
        if (exitCode == STILL_ACTIVE) {
            TerminateProcess(process.handle, 0x4C494C41);
            WaitForSingleObject(process.handle, 5000);
        }
        throw std::runtime_error("Secondary client failed its startup health check.");
    }
    AppendLog(root, "INFO", "Secondary client instance started successfully.");
    WaitForSingleObject(process.handle, INFINITE);
    return 0;
}
}
