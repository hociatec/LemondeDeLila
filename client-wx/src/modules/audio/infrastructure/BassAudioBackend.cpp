#include "modules/audio/infrastructure/BassAudioBackend.h"

#include <sstream>
#include <string>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#endif

#include "modules/audio/domain/SoundCatalog.h"
#include "modules/audio/infrastructure/BassApi.h"
#include "modules/audio/infrastructure/SoundAssetPath.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::audio::infrastructure
{
namespace
{
bool PinBassModule()
{
#ifdef _WIN32
    HMODULE module = nullptr;
    if (!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_PIN, L"bass.dll", &module))
    {
        lila::shared::logging::LogWarning(
            "Audio", "BASS DLL could not be pinned in memory; audio is disabled.");
        return false;
    }
    std::ostringstream message;
    message << "BASS DLL pinned in memory at " << static_cast<const void*>(module) << '.';
    lila::shared::logging::LogInfo("Audio", message.str());
#endif
    return true;
}
}

BassAudioBackend::BassAudioBackend()
    : modulePinned_(PinBassModule())
{
}

BassAudioBackend::~BassAudioBackend()
{
    InterruptPlayback();
    Shutdown();
}

void BassAudioBackend::Preload(domain::SoundCue cue)
{
    const auto* sound = domain::FindSoundDescriptor(cue);
    if (sound == nullptr || !EnsureInitialized())
    {
        return;
    }
    const auto path = assetPaths_.Resolve(cue);
    if (sound->loop)
    {
        streams_.Preload(cue, path);
    }
    else
    {
        static_cast<void>(samples_.GetOrLoad(cue, path));
    }
}

void BassAudioBackend::Play(domain::SoundCue cue, float volume)
{
    const auto* sound = domain::FindSoundDescriptor(cue);
    if (sound == nullptr || sound->loop || !EnsureInitialized())
    {
        return;
    }
    const HSAMPLE sample = samples_.GetOrLoad(cue, assetPaths_.Resolve(cue));
    if (sample == 0 || shuttingDown_.load(std::memory_order_acquire))
    {
        return;
    }
    const HCHANNEL channel = BASS_SampleGetChannel(sample, FALSE);
    if (channel == 0 ||
        !BASS_ChannelSetAttribute(channel, BASS_ATTRIB_VOL, volume) ||
        !BASS_ChannelPlay(channel, TRUE))
    {
        lila::shared::logging::LogWarning(
            "Audio", "BASS playback failed (error " +
                std::to_string(BASS_ErrorGetCode()) + ").");
    }
}

void BassAudioBackend::SetLoop(std::optional<domain::SoundCue> cue, float volume)
{
    if (!cue.has_value())
    {
        streams_.Stop();
        return;
    }
    const auto* sound = domain::FindSoundDescriptor(*cue);
    if (sound == nullptr || !sound->loop || !EnsureInitialized())
    {
        return;
    }
    streams_.StartOrUpdate(*cue, assetPaths_.Resolve(*cue), volume, shuttingDown_);
}

void BassAudioBackend::StopAll()
{
    if (!initialized_.load(std::memory_order_acquire))
    {
        return;
    }
    streams_.Stop();
    samples_.StopAll();
}

void BassAudioBackend::InterruptPlayback() noexcept
{
    shuttingDown_.store(true, std::memory_order_release);
    if (initialized_.load(std::memory_order_acquire))
    {
        BASS_Stop();
    }
}

void BassAudioBackend::Shutdown() noexcept
{
    if (shutdownComplete_.exchange(true, std::memory_order_acq_rel))
    {
        return;
    }
    shuttingDown_.store(true, std::memory_order_release);
    streams_.Clear();
    samples_.Clear();
    if (initialized_.exchange(false, std::memory_order_acq_rel))
    {
        BASS_Free();
    }
}

bool BassAudioBackend::EnsureInitialized()
{
    if (!modulePinned_ || shuttingDown_.load(std::memory_order_acquire))
    {
        return false;
    }
    if (initialized_.load(std::memory_order_acquire))
    {
        return true;
    }
    if (HIWORD(BASS_GetVersion()) != BASSVERSION)
    {
        lila::shared::logging::LogWarning("Audio", "BASS DLL version does not match its headers.");
        shuttingDown_.store(true, std::memory_order_release);
        return false;
    }
    if (!BASS_Init(-1, 44100, 0, nullptr, nullptr))
    {
        lila::shared::logging::LogWarning(
            "Audio", "BASS initialization failed (error " +
                std::to_string(BASS_ErrorGetCode()) + ").");
        shuttingDown_.store(true, std::memory_order_release);
        return false;
    }
    initialized_.store(true, std::memory_order_release);
    return true;
}
}
