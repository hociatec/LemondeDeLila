#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::bootstrap { struct NetworkComposition; }
namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::admin::application { class AdminService; }
namespace lila::modules::admin::infrastructure { class AdminGateway; }

namespace lila::bootstrap
{
struct AdminComposition final
{
    AdminComposition();
    ~AdminComposition();
    void Assemble(
        NetworkComposition& network,
        lila::modules::session::application::SessionStore& sessionStore,
        const StepLogger& setStep);

    std::unique_ptr<lila::modules::admin::infrastructure::AdminGateway> gateway;
    std::unique_ptr<lila::modules::admin::application::AdminService> service;
};
}
