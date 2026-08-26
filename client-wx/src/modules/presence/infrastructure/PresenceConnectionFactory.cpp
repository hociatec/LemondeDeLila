#include "modules/presence/infrastructure/PresenceConnectionFactory.h"

namespace lila::modules::presence::infrastructure
{
const std::string& TavernContextPayload()
{
    static const std::string payload = R"({"type":"presence-context","context":"tavern"})";
    return payload;
}
}
