#include <cassert>
#include <atomic>
#include <filesystem>
#include <fstream>
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
    infrastructure::BassSampleCache samples({1, 4U * 1024U * 1024U, 4U * 1024U * 1024U});
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
    assert(samples.Usage().entries == 1 && samples.Usage().bytes > 0);
    {
        std::ofstream corrupt("corrupt-audio.bin", std::ios::binary | std::ios::trunc);
        corrupt << "not an audio file";
    }
    assert(samples.GetOrLoad(domain::SoundCue::Selection, "corrupt-audio.bin") == 0);
    std::filesystem::remove("corrupt-audio.bin");
    samples.Clear();
    assert(samples.Usage().entries == 0 && samples.Usage().bytes == 0);
    assert(samples.GetOrLoad(domain::SoundCue::DiceRolled, first) != 0);
    infrastructure::BassSampleCache decodedBound({1, 1, 1});
    assert(decodedBound.GetOrLoad(domain::SoundCue::DiceRolled, first) == 0);
    assert(decodedBound.Usage().entries == 0 && decodedBound.Usage().bytes == 0);
    infrastructure::BassStreamCache streams({1, 32U * 1024U * 1024U, 32U * 1024U * 1024U});
    streams.Preload(domain::SoundCue::MainMenuMusic, first);
    streams.Preload(domain::SoundCue::TavernAmbience, second);
    assert(streams.Usage().entries == 1 && streams.Usage().bytes == std::filesystem::file_size(second));
    streams.Preload(domain::SoundCue::MainMenuMusic, "missing.wav");
    assert(streams.Usage().entries == 1);
    std::atomic_bool cancelled{false};
    streams.StartOrUpdate(domain::SoundCue::MainMenuMusic, {}, 1.0F, cancelled);
    streams.Clear();
    assert(streams.Usage().entries == 0 && streams.Usage().bytes == 0);
    const auto longAmbience = std::filesystem::path("long-table-ambience.wav");
    const auto nextAmbience = std::filesystem::path("next-table-ambience.wav");
    {
        std::ofstream firstFile(longAmbience, std::ios::binary | std::ios::trunc);
        std::ofstream secondFile(nextAmbience, std::ios::binary | std::ios::trunc);
    }
    // FakeBassApi accepts files without decoding: exercise the real stream
    // cache's file-size admission and switching with production-sized assets.
    std::filesystem::resize_file(longAmbience, 67'401'482);
    std::filesystem::resize_file(nextAmbience, 47'902'730);
    infrastructure::BassStreamCache tableStreams;
    tableStreams.StartOrUpdate(domain::SoundCue::TableAmbience13, longAmbience, 1.0F, cancelled);
    assert(tableStreams.Usage().entries == 1);
    tableStreams.StartOrUpdate(domain::SoundCue::TableAmbience17, nextAmbience, 1.0F, cancelled);
    assert(tableStreams.Usage().entries == 2);
    assert(tableStreams.Usage().bytes == 67'401'482 + 47'902'730);
    tableStreams.Clear();
    std::filesystem::remove(longAmbience);
    std::filesystem::remove(nextAmbience);
    samples.Clear();
    BASS_Free();
}
