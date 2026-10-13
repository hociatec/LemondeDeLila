#include "modules/about/infrastructure/AdminContactSender.h"
#include "generated/protocol/WsMessageTypes.generated.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"
namespace lila::modules::about::infrastructure
{
void AdminContactSender::Send(const std::string& message, std::stop_token stopToken) const
{
    namespace ws = lila::shared::network::ws::types;
    (void)lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, "Aucune session active.",
        std::string(ws::notify::inbox::Send), {{"message", message}},
        "Impossible d'envoyer le message au staff.", stopToken,
        std::string(ws::notify::inbox::Sent));
}
}
