#include "modules/audio/application/AudioService.h"

#include <array>
#include <optional>

#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/application/IAudioSettingsProvider.h"
#include "modules/audio/application/SoundVolumeResolver.h"
#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::audio::application
{
AudioService::AudioService(IAudioBackend& backend, const IAudioSettingsProvider& settingsProvider)
    : backend_(backend), settingsProvider_(settingsProvider)
{
    PreloadCommonSounds();
}

AudioService::~AudioService()
{
    ShutdownImmediately();
}

void AudioService::Play(domain::SoundCue cue)
{
    if (shuttingDown_.load(std::memory_order_acquire))
    {
        return;
    }
    const auto* sound = domain::FindSoundDescriptor(cue);
    if (sound == nullptr || sound->loop)
    {
        return;
    }
    const auto playback = ResolvePlaybackSettings(*sound, settingsProvider_.Snapshot());
    if (playback.enabled && playback.volume > 0.0F)
    {
        backend_.Play(cue, playback.volume);
    }
}

void AudioService::SetBackground(domain::AudioBackground background)
{
    if (shuttingDown_.load(std::memory_order_acquire))
    {
        return;
    }
    const std::optional<domain::SoundCue> cue = background == domain::AudioBackground::MainMenu
        ? std::optional{domain::SoundCue::MainMenuMusic}
        : background == domain::AudioBackground::Tavern
            ? std::optional{domain::SoundCue::TavernAmbience}
            : std::nullopt;
    if (!cue.has_value())
    {
        StopLoop();
        return;
    }
    StartLoop(*cue);
}

void AudioService::StartLoop(domain::SoundCue cue)
{
    if (shuttingDown_.load(std::memory_order_acquire))
    {
        return;
    }
    const auto* sound = domain::FindSoundDescriptor(cue);
    if (sound == nullptr || !sound->loop)
    {
        return;
    }
    const auto playback = ResolvePlaybackSettings(*sound, settingsProvider_.Snapshot());
    backend_.SetLoop(playback.enabled ? std::optional{cue} : std::nullopt, playback.volume);
}

void AudioService::StopLoop()
{
    if (!shuttingDown_.load(std::memory_order_acquire))
    {
        backend_.SetLoop(std::nullopt, 0.0F);
    }
}

void AudioService::StopAll()
{
    if (!shuttingDown_.load(std::memory_order_acquire))
    {
        backend_.StopAll();
    }
}

void AudioService::ShutdownImmediately()
{
    if (shuttingDown_.exchange(true, std::memory_order_acq_rel))
    {
        return;
    }
    backend_.InterruptPlayback();
    backend_.Shutdown();
}

void AudioService::PreloadCommonSounds()
{
    constexpr std::array common{
        domain::SoundCue::ClientOpened,
        domain::SoundCue::Navigation,
        domain::SoundCue::Selection,
        domain::SoundCue::ClientConnected,
        domain::SoundCue::ClientDisconnected,
        domain::SoundCue::TavernOpened,
        domain::SoundCue::MainMenuMusic,
        domain::SoundCue::TavernAmbience,
    };
    for (const auto cue : common)
    {
        backend_.Preload(cue);
    }
}
}
