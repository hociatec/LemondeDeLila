class InMemoryOptionsRepository final : public lila::modules::options::domain::IOptionsRepository
{
public:
    [[nodiscard]] lila::modules::options::domain::OptionsState Load() const override
    {
        return state_;
    }

    void Save(const lila::modules::options::domain::OptionsState& state) const override
    {
        state_ = state;
    }

private:
    mutable lila::modules::options::domain::OptionsState state_;
};

class FakeAudioService final : public lila::modules::audio::application::IAudioService
{
public:
    void Play(lila::modules::audio::domain::SoundCue cue) override
    {
        playedCues.push_back(cue);
    }

    void StartLoop(lila::modules::audio::domain::SoundCue cue) override
    {
        playedCues.push_back(cue);
    }

    void StopLoop() override {}
    void StartTableAmbience(std::string_view) override {}
    void SetTableAmbienceVolume(int) override {}

    void SetBackground(lila::modules::audio::domain::AudioBackground background) override
    {
        currentBackground = background;
    }

    void StopAll() override {}
    void ShutdownImmediately() override {}

    std::vector<lila::modules::audio::domain::SoundCue> playedCues;
    lila::modules::audio::domain::AudioBackground currentBackground =
        lila::modules::audio::domain::AudioBackground::None;
};

class FixedAudioSettingsProvider final
    : public lila::modules::audio::application::IAudioSettingsProvider
{
public:
    [[nodiscard]] lila::modules::audio::application::AudioSettings Snapshot() const override
    {
        return settings;
    }

    lila::modules::audio::application::AudioSettings settings;
};

class RecordingAudioBackend final : public lila::modules::audio::application::IAudioBackend
{
public:
    void Preload(lila::modules::audio::domain::SoundCue cue) override
    {
        preloaded.push_back(cue);
    }

    void Play(lila::modules::audio::domain::SoundCue cue, float volume) override
    {
        played.emplace_back(cue, volume);
    }

    void SetLoop(
        std::optional<lila::modules::audio::domain::SoundCue> cue,
        float volume) override
    {
        loops.emplace_back(cue, volume);
    }

    void StopAll() override { ++stopCount; }
    void InterruptPlayback() noexcept override { ++interruptCount; }
    void Shutdown() noexcept override { ++shutdownCount; }

    std::vector<lila::modules::audio::domain::SoundCue> preloaded;
    std::vector<std::pair<lila::modules::audio::domain::SoundCue, float>> played;
    std::vector<std::pair<std::optional<lila::modules::audio::domain::SoundCue>, float>> loops;
    int stopCount = 0;
    int interruptCount = 0;
    int shutdownCount = 0;
};
