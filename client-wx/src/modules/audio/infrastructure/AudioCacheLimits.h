#pragma once

#include <cstddef>
#include "modules/audio/infrastructure/SoundAssetManifest.h"

namespace lila::modules::audio::infrastructure
{
struct AudioCacheLimits final
{
    std::size_t maximumEntries;
    std::size_t maximumBytes;
    std::size_t maximumBytesPerEntry;
};

struct AudioCacheUsage final
{
    std::size_t entries = 0;
    std::size_t bytes = 0;
};

inline constexpr AudioCacheLimits SampleCacheLimits{
    32,
    64U * 1024U * 1024U,
    16U * 1024U * 1024U,
};

inline constexpr AudioCacheLimits StreamCacheLimits{
    4,
    // File streams do not load the entire source into RAM. Allow an active
    // stream and its replacement at the server's maximum file size.
    2U * MaximumRemoteSoundBytes,
    MaximumRemoteSoundBytes,
};
}
