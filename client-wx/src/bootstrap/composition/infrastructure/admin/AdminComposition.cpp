#include "bootstrap/composition/infrastructure/admin/AdminComposition.h"

#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "modules/admin/application/AdminService.h"
#include "modules/admin/infrastructure/AdminGateway.h"

namespace lila::bootstrap
{
AdminComposition::AdminComposition() = default;
AdminComposition::~AdminComposition() = default;

void AdminComposition::Assemble(
    NetworkComposition& network,
    lila::modules::session::application::SessionStore& sessionStore,
    const StepLogger& setStep)
{
    setStep("Creation des services d'administration");
    gateway = std::make_unique<lila::modules::admin::infrastructure::AdminGateway>(
        *network.authenticatedRealtimeApiClient,
        *network.notificationRealtimeApiClient,
        sessionStore);
    service = std::make_unique<lila::modules::admin::application::AdminService>(*gateway);
}
}
