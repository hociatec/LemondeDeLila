#pragma once

#include <filesystem>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
class SoundAssetPathResolver final
{
public:
    SoundAssetPathResolver();
    [[nodiscard]] std::filesystem::path Resolve(domain::SoundCue cue) const;

private:
    std::filesystem::path soundDirectory_;
};
}
