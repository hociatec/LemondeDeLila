#pragma once

#include <cstdint>
#include <mutex>

#include "modules/audio/application/IAudioSettingsProvider.h"

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::audio::infrastructure
{
class OptionsAudioSettingsProvider final : public application::IAudioSettingsProvider
{
public:
    explicit OptionsAudioSettingsProvider(
        const lila::modules::options::application::OptionsStore& optionsStore) noexcept;

    [[nodiscard]] application::AudioSettings Snapshot() const override;

private:
    const lila::modules::options::application::OptionsStore& optionsStore_;
    mutable std::mutex cacheMutex_;
    mutable std::uint64_t cachedRevision_ = 0;
    mutable application::AudioSettings cachedSettings_;
    mutable bool hasCachedSettings_ = false;
};
}
