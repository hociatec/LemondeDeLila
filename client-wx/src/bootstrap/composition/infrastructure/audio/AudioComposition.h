#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::modules::audio::application
{
class IAudioBackend;
class IAudioService;
class IAudioSettingsProvider;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::bootstrap
{
struct AudioComposition final
{
    AudioComposition();
    ~AudioComposition();

    void Assemble(
        lila::modules::options::application::OptionsStore& optionsStore,
        const StepLogger& setStep);

    std::unique_ptr<lila::modules::audio::application::IAudioSettingsProvider> audioSettingsProvider;
    std::unique_ptr<lila::modules::audio::application::IAudioBackend> audioBackend;
    std::unique_ptr<lila::modules::audio::application::IAudioService> audioService;
};
}
