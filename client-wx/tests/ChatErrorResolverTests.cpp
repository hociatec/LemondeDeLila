#include <cassert>
#include <optional>
#include <string>

#include "modules/chat/presentation/ChatErrorResolver.h"

int main()
{
    using lila::modules::chat::domain::ChatServerError;
    using lila::modules::chat::presentation::ChatErrorResolver;

    ChatServerError detailed;
    detailed.message = "Serveur indisponible";
    detailed.reason = "maintenance";

    const auto detailedResult = ChatErrorResolver::Resolve("Erreur tchat.", detailed);
    assert(detailedResult.find("Serveur indisponible") != std::string::npos);
    assert(detailedResult.find("maintenance") != std::string::npos);

    const auto usefulBase = ChatErrorResolver::Resolve("Erreur précise", detailed);
    assert(usefulBase == "Erreur précise");

    ChatServerError reasonOnly;
    reasonOnly.reason = "interdit";
    const auto reasonResult = ChatErrorResolver::Resolve("", reasonOnly);
    assert(reasonResult.find("interdit") != std::string::npos);

    const auto noDetail = ChatErrorResolver::Resolve("Erreur précise", std::nullopt);
    assert(noDetail == "Erreur précise");
    return 0;
}
