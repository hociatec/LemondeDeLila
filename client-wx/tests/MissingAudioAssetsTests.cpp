#include <cassert>
#include <filesystem>

#include "modules/audio/domain/SoundCue.h"
#include "modules/audio/infrastructure/LocalSoundManifest.h"

int main()
{
    using lila::modules::audio::domain::SoundCue;
    using lila::modules::audio::infrastructure::FindLocalSoundAsset;

    const auto absentDirectory = std::filesystem::temp_directory_path() /
        "lemonde-de-lila-audio-assets-that-do-not-exist" / "missing";
    assert(!std::filesystem::exists(absentDirectory));

    for (std::size_t index = 0; index < static_cast<std::size_t>(SoundCue::Count); ++index)
        assert(FindLocalSoundAsset(absentDirectory, static_cast<SoundCue>(index)).empty());
    assert(FindLocalSoundAsset(absentDirectory, SoundCue::Count).empty());
    using lila::modules::audio::infrastructure::GetLocalSoundFile;
    for (auto index = static_cast<std::size_t>(SoundCue::TableAmbience1);
        index <= static_cast<std::size_t>(SoundCue::TableAmbience20); ++index)
        assert(GetLocalSoundFile(static_cast<SoundCue>(index)).empty());
    assert(GetLocalSoundFile(SoundCue::TavernAmbience) == L"TavernAmbience.wav");
}
