#include "modules/audio/infrastructure/OptionsAudioSettingsProvider.h"

#include "modules/options/application/OptionsStore.h"
#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::audio::infrastructure
{
OptionsAudioSettingsProvider::OptionsAudioSettingsProvider(
    const lila::modules::options::application::OptionsStore& optionsStore) noexcept
    : optionsStore_(optionsStore)
{
}

application::AudioSettings OptionsAudioSettingsProvider::Snapshot() const
{
    const auto revision = optionsStore_.Revision();
    std::scoped_lock lock(cacheMutex_);
    if (hasCachedSettings_ && cachedRevision_ == revision)
    {
        return cachedSettings_;
    }

    const auto options = optionsStore_.Current();
    application::AudioSettings result;
    result.muteAll = options.audio.muteAll;
    result.ambienceEnabled = options.audio.soundAmbience;
    result.appLaunchEnabled = options.audio.soundAppLaunch;
    result.navigationEnabled = options.audio.soundNavigate;
    result.selectionEnabled = options.audio.soundSelect;
    result.messagesEnabled = options.audio.soundChatMessages;
    result.tableAmbienceEnabled = options.audio.soundTableAmbience;
    result.splitAmbienceVolume = options.audio.soundAmbienceSplit;
    result.ambienceVolume = options.audio.soundAmbienceVolume;
    result.menuAmbienceVolume = options.audio.soundMenuAmbienceVolume;
    result.tavernAmbienceVolume = options.audio.soundTavernAmbienceVolume;
    result.appLaunchVolume = options.audio.soundAppLaunchVolume;
    result.navigationVolume = options.audio.soundNavigateVolume;
    result.selectionVolume = options.audio.soundSelectVolume;
    result.messagesVolume = options.audio.soundChatMessagesVolume;
    result.tableAmbienceVolume = options.audio.soundTableAmbienceVolume;
    for (const auto& sound : domain::GetSoundCatalog())
    {
        const auto configured = options.audio.cues.find(sound.key);
        if (configured == options.audio.cues.end())
        {
            continue;
        }
        result.cues[static_cast<std::size_t>(sound.cue)] = {
            configured->second.enabled,
            configured->second.volume,
        };
    }
    cachedSettings_ = result;
    cachedRevision_ = revision;
    hasCachedSettings_ = true;
    return cachedSettings_;
}
}
