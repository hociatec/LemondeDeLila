#pragma once

#include <cstdint>
#include <mutex>

#include "modules/audio/application/IAudioSettingsProvider.h"

namespace lila::modules::options::application { class OptionsStore; }

namespace lila::modules::options::infrastructure
{
class OptionsAudioSettingsProvider final
    : public lila::modules::audio::application::IAudioSettingsProvider
{
public:
    explicit OptionsAudioSettingsProvider(const application::OptionsStore& optionsStore) noexcept;
    [[nodiscard]] lila::modules::audio::application::AudioSettings Snapshot() const override;

private:
    const application::OptionsStore& optionsStore_;
    mutable std::mutex cacheMutex_;
    mutable std::uint64_t cachedRevision_ = 0;
    mutable lila::modules::audio::application::AudioSettings cachedSettings_;
    mutable bool hasCachedSettings_ = false;
};
}
