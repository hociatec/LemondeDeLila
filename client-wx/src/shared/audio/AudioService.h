#pragma once

#include <memory>

#include "shared/audio/SoundCatalog.h"

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::shared::audio
{
enum class AudioBackground
{
    None,
    MainMenu,
    Tavern,
};

class AudioService final
{
public:
    explicit AudioService(lila::modules::options::application::OptionsStore& optionsStore);
    ~AudioService();

    AudioService(const AudioService&) = delete;
    AudioService& operator=(const AudioService&) = delete;

    void Play(SoundCue cue);
    void SetBackground(AudioBackground background);
    void StopAll();
    void ShutdownImmediately();

    static void PlayGlobal(SoundCue cue);

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};
}
