#include <cassert>
#include <atomic>
#include <filesystem>
#include <string_view>
#include "modules/audio/infrastructure/BassSampleCache.h"
#include "modules/audio/infrastructure/BassStreamCache.h"

namespace lila::shared::logging
{
void LogWarning(std::string_view, std::string_view) {}
}

int main()
{
    using namespace lila::modules::audio;
    assert(BASS_Init(0, 44100, 0, nullptr, nullptr)); // Silent device, no speakers.
    const auto first = std::filesystem::path("resources/sounds/DiceRolled.wav");
    const auto second = std::filesystem::path("resources/sounds/ClientDisconnected.wav");
    infrastructure::BassSampleCache samples;
    const auto handle = samples.GetOrLoad(domain::SoundCue::DiceRolled, first);
    assert(handle != 0);
    BASS_SAMPLE original{};
    assert(BASS_SampleGetInfo(handle, &original));
    assert(samples.GetOrLoad(domain::SoundCue::DiceRolled, {}) == 0);
    const auto replacement = samples.GetOrLoad(domain::SoundCue::DiceRolled, second);
    BASS_SAMPLE updated{};
    assert(replacement != 0 && BASS_SampleGetInfo(replacement, &updated));
    assert(original.length != updated.length);
    assert(samples.GetOrLoad(domain::SoundCue::DrawCard, "missing.wav") == 0);
    assert(samples.GetOrLoad(domain::SoundCue::DrawCard, first) != 0);
    samples.Clear();
    assert(samples.GetOrLoad(domain::SoundCue::DiceRolled, first) != 0);
    infrastructure::BassStreamCache streams;
    streams.Preload(domain::SoundCue::MainMenuMusic, first);
    streams.Preload(domain::SoundCue::MainMenuMusic, second);
    std::atomic_bool cancelled{false};
    streams.StartOrUpdate(domain::SoundCue::MainMenuMusic, {}, 1.0F, cancelled);
    streams.Clear();
    samples.Clear();
    BASS_Free();
}
