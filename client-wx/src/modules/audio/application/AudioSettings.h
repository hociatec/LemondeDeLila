#pragma once

#include <array>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::application
{
struct CueAudioSettings final
{
    bool enabled = true;
    int volume = 100;
};

struct AudioSettings final
{
    bool muteAll = false;
    bool ambienceEnabled = true;
    bool appLaunchEnabled = true;
    bool navigationEnabled = true;
    bool selectionEnabled = true;
    bool messagesEnabled = true;
    bool tableAmbienceEnabled = true;
    bool splitAmbienceVolume = false;
    int ambienceVolume = 25;
    int menuAmbienceVolume = 25;
    int tavernAmbienceVolume = 25;
    int appLaunchVolume = 50;
    int navigationVolume = 50;
    int selectionVolume = 50;
    int messagesVolume = 50;
    int tableAmbienceVolume = 15;
    std::array<CueAudioSettings, static_cast<std::size_t>(domain::SoundCue::Count)> cues{};
};

struct ResolvedPlaybackSettings final
{
    bool enabled = false;
    float volume = 0.0F;
};
}
