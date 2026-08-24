#include "modules/audio/application/SoundVolumeResolver.h"

#include <algorithm>

namespace lila::modules::audio::application
{
namespace
{
float ToVolume(int value) noexcept
{
    return static_cast<float>(std::clamp(value, 0, 100)) / 100.0F;
}
}

ResolvedPlaybackSettings ResolvePlaybackSettings(
    const domain::SoundDescriptor& sound,
    const AudioSettings& settings) noexcept
{
    if (settings.muteAll)
    {
        return {};
    }

    bool familyEnabled = true;
    int familyVolume = 100;
    using enum domain::SoundFamily;
    switch (sound.family)
    {
    case AppLaunch:
        familyEnabled = settings.appLaunchEnabled;
        familyVolume = settings.appLaunchVolume;
        break;
    case Ambience:
        familyEnabled = settings.ambienceEnabled;
        familyVolume = settings.splitAmbienceVolume
            ? (sound.cue == domain::SoundCue::MainMenuMusic
                ? settings.menuAmbienceVolume
                : settings.tavernAmbienceVolume)
            : settings.ambienceVolume;
        break;
    case Navigate:
        familyEnabled = settings.navigationEnabled;
        familyVolume = settings.navigationVolume;
        break;
    case Select:
        familyEnabled = settings.selectionEnabled;
        familyVolume = settings.selectionVolume;
        break;
    case Messages:
        familyEnabled = settings.messagesEnabled;
        familyVolume = settings.messagesVolume;
        break;
    case TableAmbience:
        familyEnabled = settings.tableAmbienceEnabled;
        familyVolume = settings.tableAmbienceVolume;
        break;
    }

    bool cueEnabled = true;
    int cueVolume = 100;
    const auto cueIndex = static_cast<std::size_t>(sound.cue);
    if (cueIndex < settings.cues.size())
    {
        cueEnabled = settings.cues[cueIndex].enabled;
        cueVolume = settings.cues[cueIndex].volume;
    }

    return {
        familyEnabled && cueEnabled,
        ToVolume(familyVolume) * ToVolume(cueVolume),
    };
}
}
