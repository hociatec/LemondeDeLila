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

    guard.Reset();
    Expect(guard.TryBegin("game.action", 12, 3, start),
        "Une nouvelle action doit être verrouillée");
    Expect(guard.Acknowledge("game.action", false),
        "Un accusé positif peut conserver le verrou jusqu'à l'état suivant");
    Expect(!guard.TryBegin("game.action", 12, 3, start),
        "Une seconde Entrée ne doit pas réemployer la version reconnue");
    guard.ObserveState(13, 3);
    Expect(guard.TryBegin("game.action", 13, 3, start),
        "Le nouvel état serveur doit libérer l'action validée");
}

void TestStructuredGameAcknowledgements()
{
    using Codec = lila::modules::gameplay::infrastructure::GameEventPayloadCodec;
    const auto event = Codec::Decode(nlohmann::json{
        {"type", "game.ack"},
        {"payload", {
            {"action", "game.key"},
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
            {{"type", "card.choose"}, {"payload", {{"cardId", "fox"}}}}})},
        {"offset", 50}, {"limit", 25}, {"nextOffset", 75}});
    Expect(decoded.items.size() == 1 &&
            decoded.items[0].payload.at("cardId") == "fox" &&
            decoded.nextOffset == 75,
        "La page de candidats doit conserver les valeurs originales et la suite.");
}
