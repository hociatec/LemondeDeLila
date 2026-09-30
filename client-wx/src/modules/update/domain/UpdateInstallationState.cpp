#include "modules/update/domain/UpdateInstallationState.h"

namespace lila::modules::update
{
void PrepareUpdateActivation(
    UpdateInstallationState& state,
    const UpdateManifest& manifest)
{
    state.previousVersion = state.currentVersion;
    state.previousReleaseId = state.currentReleaseId;
    state.currentVersion = manifest.version;
    state.currentReleaseId = manifest.releaseId;
}

bool RollbackFailedUpdate(UpdateInstallationState& state)
{
    if (state.previousReleaseId.empty()) return false;
    state.failedReleaseId = state.currentReleaseId;
    state.failedVersion = state.currentVersion;
    state.currentReleaseId = state.previousReleaseId;
    state.currentVersion = state.previousVersion;
    state.previousReleaseId.clear();
    state.previousVersion.clear();
    return true;
}
}
