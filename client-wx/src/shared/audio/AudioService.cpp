#include "shared/audio/AudioService.h"

#include <algorithm>
#include <filesystem>
#include <mutex>
#include <string>
#include <unordered_map>
#include <unordered_set>

#include <bass.h>

#include "modules/options/application/OptionsStore.h"
#include "shared/logging/Logger.h"

#ifdef _WIN32
#include <windows.h>
#endif

namespace lila::shared::audio
{
namespace
{
std::mutex activeServiceMutex;
AudioService* activeService = nullptr;

float ToVolume(int value)
{
    return static_cast<float>(std::clamp(value, 0, 100)) / 100.0F;
}

std::filesystem::path SoundDirectory()
{
#ifdef _WIN32
    std::wstring executablePath(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, executablePath.data(), static_cast<DWORD>(executablePath.size()));
    if (length == 0 || length >= executablePath.size())
    {
        return {};
    }
    executablePath.resize(length);
    return std::filesystem::path(executablePath).parent_path() / L"resources" / L"sounds";
#else
    return {};
#endif
}

struct ResolvedSettings final
{
    bool enabled = false;
    float volume = 0.0F;
};

ResolvedSettings ResolveSettings(
    const SoundDescriptor& descriptor,
    const lila::modules::options::domain::OptionsState& options)
{
    if (options.muteAll)
    {
        return {};
    }

    bool familyEnabled = true;
    int familyVolume = 100;
    switch (descriptor.family)
    {
    case SoundFamily::AppLaunch:
        familyEnabled = options.soundAppLaunch;
        familyVolume = options.soundAppLaunchVolume;
        break;
    case SoundFamily::Ambience:
        familyEnabled = options.soundAmbience;
        familyVolume = descriptor.cue == SoundCue::MainMenuMusic
            ? options.soundMenuAmbienceVolume
            : options.soundTavernAmbienceVolume;
        break;
    case SoundFamily::Navigate:
        familyEnabled = options.soundNavigate;
        familyVolume = options.soundNavigateVolume;
        break;
    case SoundFamily::Select:
        familyEnabled = options.soundSelect;
        familyVolume = options.soundSelectVolume;
        break;
    case SoundFamily::Messages:
        familyEnabled = options.soundChatMessages;
        familyVolume = options.soundChatMessagesVolume;
        break;
    case SoundFamily::TableAmbience:
        familyEnabled = options.soundTableAmbience;
        familyVolume = options.soundTableAmbienceVolume;
        break;
    }

    bool cueEnabled = true;
    int cueVolume = 100;
    const auto cue = options.audio.cues.find(descriptor.key);
    if (cue != options.audio.cues.end())
    {
        cueEnabled = cue->second.enabled;
        cueVolume = cue->second.volume;
    }

    return {
        familyEnabled && cueEnabled,
        ToVolume(familyVolume) * ToVolume(cueVolume),
    };
}
}

class AudioService::Impl final
{
public:
    explicit Impl(lila::modules::options::application::OptionsStore& optionsStore)
        : optionsStore_(optionsStore), soundDirectory_(SoundDirectory())
    {
        if (HIWORD(BASS_GetVersion()) != BASSVERSION)
        {
            lila::shared::logging::LogWarning("Audio", "BASS DLL version does not match the bundled headers.");
            return;
        }
        if (!BASS_Init(-1, 44100, 0, nullptr, nullptr))
        {
            lila::shared::logging::LogWarning(
                "Audio",
                "BASS initialization failed (error " + std::to_string(BASS_ErrorGetCode()) + ").");
            return;
        }
        initialized_ = true;
    }

    ~Impl()
    {
        ShutdownImmediately();
    }

    void Play(SoundCue cue)
    {
        const SoundDescriptor& descriptor = GetSoundDescriptor(cue);
        if (descriptor.loop)
        {
            return;
        }
        const ResolvedSettings settings = ResolveSettings(descriptor, optionsStore_.Current());
        if (!settings.enabled || settings.volume <= 0.0F)
        {
            return;
        }

        std::scoped_lock lock(mutex_);
        if (!initialized_ || shuttingDown_)
        {
            return;
        }
        const HSAMPLE sample = GetOrLoadSample(descriptor);
        if (sample == 0)
        {
            return;
        }
        const HCHANNEL channel = BASS_SampleGetChannel(sample, FALSE);
        if (channel == 0 ||
            !BASS_ChannelSetAttribute(channel, BASS_ATTRIB_VOL, settings.volume) ||
            !BASS_ChannelPlay(channel, TRUE))
        {
            lila::shared::logging::LogWarning(
                "Audio",
                "BASS playback failed for " + std::string(descriptor.key) +
                    " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
        }
    }

    void SetBackground(AudioBackground background)
    {
        std::scoped_lock lock(mutex_);
        StopLoopLocked();
        if (!initialized_ || shuttingDown_ || background == AudioBackground::None)
        {
            return;
        }

        const SoundCue cue = background == AudioBackground::MainMenu
            ? SoundCue::MainMenuMusic
            : SoundCue::TavernAmbience;
        const SoundDescriptor& descriptor = GetSoundDescriptor(cue);
        const ResolvedSettings settings = ResolveSettings(descriptor, optionsStore_.Current());
        if (!settings.enabled || settings.volume <= 0.0F)
        {
            return;
        }

        const auto path = soundDirectory_ / descriptor.fileName;
        loop_ = BASS_StreamCreateFile(
            FALSE,
            path.c_str(),
            0,
            0,
            BASS_UNICODE | BASS_SAMPLE_LOOP | BASS_STREAM_PRESCAN);
        if (loop_ == 0)
        {
            LogMissingOrInvalid(descriptor, path);
            return;
        }
        if (!BASS_ChannelSetAttribute(loop_, BASS_ATTRIB_VOL, settings.volume) ||
            !BASS_ChannelPlay(loop_, TRUE))
        {
            lila::shared::logging::LogWarning(
                "Audio",
                "BASS loop playback failed for " + std::string(descriptor.key) +
                    " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
            BASS_StreamFree(loop_);
            loop_ = 0;
        }
    }

    void StopAll()
    {
        std::scoped_lock lock(mutex_);
        if (!initialized_)
        {
            return;
        }
        StopLoopLocked();
        for (const auto& [key, sample] : samples_)
        {
            static_cast<void>(key);
            BASS_SampleStop(sample);
        }
    }

    void ShutdownImmediately()
    {
        std::scoped_lock lock(mutex_);
        if (!initialized_ || shuttingDown_)
        {
            return;
        }
        shuttingDown_ = true;
        BASS_Stop();
        StopLoopLocked();
        for (const auto& [key, sample] : samples_)
        {
            static_cast<void>(key);
            BASS_SampleFree(sample);
        }
        samples_.clear();
        BASS_Free();
        initialized_ = false;
    }

private:
    HSAMPLE GetOrLoadSample(const SoundDescriptor& descriptor)
    {
        const auto cached = samples_.find(descriptor.cue);
        if (cached != samples_.end())
        {
            return cached->second;
        }

        const auto path = soundDirectory_ / descriptor.fileName;
        const HSAMPLE sample = BASS_SampleLoad(
            FALSE,
            path.c_str(),
            0,
            0,
            8,
            BASS_UNICODE | BASS_SAMPLE_OVER_POS);
        if (sample == 0)
        {
            LogMissingOrInvalid(descriptor, path);
            return 0;
        }
        samples_[descriptor.cue] = sample;
        return sample;
    }

    void LogMissingOrInvalid(const SoundDescriptor& descriptor, const std::filesystem::path& path)
    {
        if (failedSounds_.insert(descriptor.cue).second)
        {
            lila::shared::logging::LogWarning(
                "Audio",
                "BASS could not load " + path.string() +
                    " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
        }
    }

    void StopLoopLocked()
    {
        if (loop_ != 0)
        {
            BASS_ChannelStop(loop_);
            BASS_StreamFree(loop_);
            loop_ = 0;
        }
    }

    lila::modules::options::application::OptionsStore& optionsStore_;
    std::filesystem::path soundDirectory_;
    std::mutex mutex_;
    std::unordered_map<SoundCue, HSAMPLE> samples_;
    std::unordered_set<SoundCue> failedSounds_;
    HSTREAM loop_ = 0;
    bool initialized_ = false;
    bool shuttingDown_ = false;
};

AudioService::AudioService(lila::modules::options::application::OptionsStore& optionsStore)
    : impl_(std::make_unique<Impl>(optionsStore))
{
    std::scoped_lock lock(activeServiceMutex);
    activeService = this;
}

AudioService::~AudioService()
{
    std::scoped_lock lock(activeServiceMutex);
    if (activeService == this)
    {
        activeService = nullptr;
    }
}

void AudioService::Play(SoundCue cue)
{
    impl_->Play(cue);
}

void AudioService::SetBackground(AudioBackground background)
{
    impl_->SetBackground(background);
}

void AudioService::StopAll()
{
    impl_->StopAll();
}

void AudioService::ShutdownImmediately()
{
    impl_->ShutdownImmediately();
}

void AudioService::PlayGlobal(SoundCue cue)
{
    std::scoped_lock lock(activeServiceMutex);
    if (activeService != nullptr)
    {
        activeService->Play(cue);
    }
}
}
