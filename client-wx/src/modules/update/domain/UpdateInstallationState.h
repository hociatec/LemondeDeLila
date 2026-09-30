#pragma once

#include <cstdint>
#include <string>

#include "modules/update/domain/UpdateProtocol.h"

namespace lila::modules::update
{
struct UpdateInstallationState
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

void PrepareUpdateActivation(
    UpdateInstallationState& state,
    const UpdateManifest& manifest);
[[nodiscard]] bool RollbackFailedUpdate(UpdateInstallationState& state);
}
