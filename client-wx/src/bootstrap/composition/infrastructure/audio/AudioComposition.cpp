#include "bootstrap/composition/infrastructure/audio/AudioComposition.h"

#include <memory>

#include "modules/audio/application/AudioService.h"
#include "modules/audio/infrastructure/AsyncAudioBackend.h"
#include "modules/audio/infrastructure/BassAudioBackend.h"
#include "modules/audio/infrastructure/OptionsAudioSettingsProvider.h"

namespace lila::bootstrap
{
AudioComposition::AudioComposition() = default;
AudioComposition::~AudioComposition() = default;

void AudioComposition::Assemble(
    lila::modules::options::application::OptionsStore& optionsStore,
    const StepLogger& setStep)
{
    setStep("Creation du moteur audio BASS asynchrone");
    audioSettingsProvider =
        std::make_unique<lila::modules::audio::infrastructure::OptionsAudioSettingsProvider>(
            optionsStore);
    audioBackend = std::make_unique<lila::modules::audio::infrastructure::AsyncAudioBackend>(
        std::make_unique<lila::modules::audio::infrastructure::BassAudioBackend>());
    audioService = std::make_unique<lila::modules::audio::application::AudioService>(
        *audioBackend,
        *audioSettingsProvider);
}
}
