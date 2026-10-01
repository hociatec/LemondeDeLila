void TestCommandSubmissionGuardSerializesGameplayCommands()
{
    using Guard = lila::modules::gameplay::application::GameCommandSubmissionGuard;
    Guard guard;
    const auto start = Guard::TimePoint{};

    Expect(guard.TryBegin("game.action", 10, 3, start),
        "La premiere action de jeu doit partir");
    Expect(!guard.TryBegin("game.key", 10, 3, start + std::chrono::milliseconds(100)),
        "Une rafale clavier ne doit pas lancer un second flux de commande");

    guard.ObserveState(10, 3);
    Expect(guard.IsInFlight(),
        "Un etat identique ne doit pas liberer prematurément l'action");
    guard.ObserveState(11, 3);
    Expect(!guard.IsInFlight(),
        "Le nouvel etat serveur doit autoriser l'action suivante");

    Expect(guard.TryBegin("game.key", 11, 3, start),
        "Une touche doit repartir apres synchronisation");
    Expect(!guard.Acknowledge("game.action"),
        "Un acquittement d'un autre flux ne doit rien liberer");
    Expect(guard.Acknowledge("game.key"),
        "L'acquittement game.key doit etre reconnu");
    Expect(guard.TryBegin("game.action", 11, 3, start),
        "Un acquittement sans nouvel etat doit aussi liberer l'envoi");

    guard.ObserveState(1, 4);
    Expect(!guard.IsInFlight(),
        "Une nouvelle execution de table doit liberer la commande precedente");

    Expect(guard.TryBegin("game.action", 1, 4, start),
        "Une action doit partir sur la nouvelle execution");
    Expect(!guard.TryBegin("game.key", 1, 4, start + std::chrono::seconds(6)),
        "Une action sans réponse ne doit jamais être rejouée aveuglément");
    Expect(!guard.RecoverIfExpired(start + std::chrono::seconds(14)),
        "La récupération ne doit pas libérer une commande trop tôt");
    Expect(guard.RecoverIfExpired(start + std::chrono::seconds(15)),
        "Une commande sans ACK doit être libérée après un délai borné");
    Expect(!guard.IsInFlight(),
        "La récupération bornée doit rendre l'interface de nouveau interactive");

    Expect(guard.TryBegin("game.action", 12, 3, start),
        "Une nouvelle action doit être verrouillée");
    Expect(guard.Acknowledge("game.action", false),
        "Un accusé positif peut conserver le verrou jusqu'à l'état suivant");
    Expect(!guard.TryBegin("game.action", 12, 3, start),
        "Une seconde Entrée ne doit pas réemployer la version reconnue");
    guard.ObserveState(13, 3);
    Expect(guard.TryBegin("game.action", 13, 3, start),
        "Le nouvel état serveur doit libérer l'action validée");
    guard.ObserveState(1, 9);
    Expect(!guard.IsInFlight(),
        "Une réponse tardive d'un ancien run ne doit pas verrouiller le nouveau run");

    Expect(guard.TryBegin("game.action", 20, 9, start, "new-command"),
        "Une action corrélée doit partir");
    Expect(!guard.Acknowledge("game.action", true, "old-command"),
        "Un ACK tardif d'une ancienne commande ne doit pas libérer la nouvelle");
    Expect(guard.IsInFlight(),
        "La nouvelle commande doit rester protégée après l'ancien ACK");
    Expect(guard.Acknowledge("game.action", true, "new-command"),
        "L'ACK corrélé doit libérer sa propre commande");
}

void TestStructuredGameAcknowledgements()
{
    using Codec = lila::modules::gameplay::infrastructure::GameEventPayloadCodec;
    const auto event = Codec::Decode(nlohmann::json{
        {"type", "game.ack"},
        {"payload", {
            {"action", "game.key"},
            {"commandId", "command-42"},
            {"ok", false},
            {"key", "SPACE"},
            {"panelId", "discard"},
            {"message", "Pioche indisponible."},
        }},
    });

    Expect(event.acknowledgement.has_value(),
        "Un acquittement de touche doit conserver sa structure");
    Expect(event.acknowledgement->command == "game.key",
        "La commande acquittee doit rester identifiable");
    Expect(event.acknowledgement->commandId == "command-42",
        "La corrélation de l'acquittement doit être conservée");
    Expect(!event.acknowledgement->ok && event.isError,
        "Un refus serveur doit etre expose comme tel");
    Expect(event.acknowledgement->key == "SPACE" &&
        event.acknowledgement->panelId == "discard",
        "La touche et le panneau serveur doivent etre conserves");
    Expect(event.acknowledgement->message == "Pioche indisponible.",
        "Le retour utilisateur du serveur ne doit pas etre perdu");
}

void TestStructuredBackendErrorsAreReadable()
{
    using Codec = lila::modules::gameplay::infrastructure::GameEventPayloadCodec;
    const auto conflict = Codec::Decode(nlohmann::json{
        {"type", "error"},
        {"payload", {
            {"code", "GAME_STATE_CONFLICT"},
            {"params", nlohmann::json::object()},
        }},
    });

    Expect(
        conflict.type == lila::modules::gameplay::domain::GameEventType::Error &&
            conflict.errorCode == "GAME_STATE_CONFLICT" &&
            conflict.message ==
                "La partie a chang\xC3\xA9""; actualisez puis r\xC3\xA9""essayez.",
        "Une erreur codee du backend doit produire un message utilisateur precis");

    const auto unknown = Codec::Decode(nlohmann::json{
        {"type", "error"},
        {"payload", {
            {"code", "INTERNAL_DATABASE_FAILURE"},
            {"message", "SELECT secret FROM users"},
            {"error", "stack trace"},
        }},
    });
    Expect(unknown.message == "Action de jeu impossible.",
        "Une erreur technique inconnue ne doit jamais etre affichee directement");
}

void TestActionCandidatesContract()
{
    using Codec = lila::modules::gameplay::infrastructure::GameCommandPayloadCodec;
    lila::modules::gameplay::domain::GameActionCandidatesRequest request;
    request.actionType = "card.choose";
    request.query.emplace("search",
        lila::modules::gameplay::domain::GameValue{std::string("renard")});
    request.offset = 50;
    request.limit = 25;
    const auto encoded = Codec::EncodeCandidatesRequest(7, "cards", request);
    Expect(encoded.at("actionType") == "card.choose" &&
            encoded.at("query").at("search") == "renard" &&
            encoded.at("offset") == 50 && encoded.at("limit") == 25,
        "La requête de candidats doit conserver recherche et pagination.");

    const auto decoded = Codec::DecodeCandidates({
        {"roomId", 7}, {"gameType", "cards"}, {"actionType", "card.choose"},
        {"items", nlohmann::json::array({
            {{"type", "card.choose"}, {"payload", {{"cardId", "fox"},
                {"meta", {{"count", 2},
                    {"tags", nlohmann::json::array({"red", "fast"})}}}}}}})},
        {"offset", 50}, {"limit", 25}, {"nextOffset", 75}});
    Expect(decoded.items.size() == 1, "Un candidat devait etre decode.");
    const auto* metadata = decoded.items.front().payload.at("meta").ObjectValue();
    Expect(decoded.items.front().payload.at("cardId") == "fox" &&
            metadata != nullptr && metadata->at("count").Integer() == 2 &&
            metadata->at("tags").ArrayValue() != nullptr &&
            metadata->at("tags").ArrayValue()->size() == 2 &&
            decoded.nextOffset == 75,
        "La page de candidats doit conserver les valeurs originales et la suite.");

    request.offset = -10;
    request.limit = 50'000;
    const auto boundedRequest = Codec::EncodeCandidatesRequest(7, "cards", request);
    const auto boundedResponse = Codec::DecodeCandidates({
        {"roomId", 7}, {"gameType", "cards"}, {"actionType", "card.choose"},
        {"items", nlohmann::json::array()},
        {"offset", 2'000'000}, {"limit", -4}, {"nextOffset", 2'000'001}});
    Expect(boundedRequest.at("offset") == 0 && boundedRequest.at("limit") == 200 &&
            boundedResponse.offset == 1'000'000 && boundedResponse.limit == 1 &&
            boundedResponse.nextOffset == 1'000'000,
        "Offsets et limites de candidats doivent rester dans les bornes réseau.");
}
