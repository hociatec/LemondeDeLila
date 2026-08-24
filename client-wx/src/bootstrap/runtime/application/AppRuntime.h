#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"
#include "bootstrap/composition/infrastructure/audio/AudioComposition.h"
#include "bootstrap/composition/infrastructure/game/GameComposition.h"
#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "bootstrap/composition/infrastructure/social/SocialComposition.h"
#include "bootstrap/composition/infrastructure/user/UserComposition.h"

namespace lila::app::navigation
{
class AppNavigator;
}

namespace lila::bootstrap
{
class AppRuntime final
{
public:
    AppRuntime();
    ~AppRuntime();

    void Assemble(const StepLogger& setStep);
    bool StartNavigator() const;

private:
    void CreateNavigator(const StepLogger& setStep);

    NetworkComposition network_;
    UserComposition user_;
    AudioComposition audio_;
    GameComposition game_;
    SocialComposition social_;
    std::unique_ptr<lila::app::navigation::AppNavigator> navigator_;
};
}
