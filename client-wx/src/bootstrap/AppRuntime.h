#pragma once

#include <memory>

#include "bootstrap/AppCompositions.h"

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
    GameComposition game_;
    SocialComposition social_;
    std::unique_ptr<lila::app::navigation::AppNavigator> navigator_;
};
}
