#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>

#include "modules/update/domain/UpdateInstallationState.h"
#include "modules/update/infrastructure/launcher/UpdateStagingCleanup.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}
}

int main()
{
    namespace fs = std::filesystem;
    try
    {
        using namespace lila::modules::update;
        UpdateInstallationState state;
        state.currentVersion = "1.0.0";
        state.currentReleaseId = "release-1";
        UpdateManifest candidate;
        candidate.version = "2.0.0";
        candidate.releaseId = "release-2";
        PrepareUpdateActivation(state, candidate);
        Expect(state.currentReleaseId == "release-2" &&
                state.previousReleaseId == "release-1",
            "Activation must retain the valid release until the health check succeeds.");
        Expect(RollbackFailedUpdate(state) && state.currentReleaseId == "release-1" &&
                state.failedReleaseId == "release-2" && state.previousReleaseId.empty(),
            "An interrupted or unhealthy activation must roll back deterministically.");
        Expect(!RollbackFailedUpdate(state),
            "Rollback without a retained valid release must be rejected.");

        const auto staging = fs::temp_directory_path() /
            ("lila-update-recovery-" + std::to_string(
                std::chrono::steady_clock::now().time_since_epoch().count()));
        fs::create_directories(staging / "release.extracting");
        std::ofstream(staging / "release.partial") << "partial";
        const auto older = staging / "release-1.download.zip";
        const auto newer = staging / "release-2.download.zip";
        std::ofstream(older) << "old";
        std::ofstream(newer) << "new";
        fs::last_write_time(older, fs::file_time_type::clock::now() - std::chrono::hours(1));
        lila::modules::update::launcher::CleanupUpdateStagingDirectory(staging);
        Expect(!fs::exists(staging / "release.extracting") &&
                !fs::exists(staging / "release.partial") && !fs::exists(older) &&
                fs::is_regular_file(newer),
            "Startup cleanup must remove partial work and retain only the newest resumable archive.");
        fs::remove(newer);
        lila::modules::update::launcher::CleanupUpdateStagingDirectory(staging);
        Expect(fs::is_empty(staging), "Successful update cleanup must leave no staging payload.");
        fs::remove_all(staging);

        std::cout << "Update recovery tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Update recovery test failed: " << error.what() << '\n';
        return 1;
    }
}
