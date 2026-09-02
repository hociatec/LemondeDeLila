void TestRealtimeProtocolStrictCorrelationAndPayloadValidation()
{
    Expect(
        !lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"room.restore.ready","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "Une notification de restauration ne doit pas terminer la requete vault.restore");
    Expect(
        lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"vault.restore","requestId":"req-1","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "La reponse correlee de restauration doit etre acceptee");
    Expect(
        !lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"vault.restore","requestId":"req-2","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "La reponse d'une autre requete doit etre ignoree");
    Expect(
        lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"error","context":"vault.restore","requestId":"req-1","payload":{"message":"Session expiree"}})",
            "req-1",
            "vault.restore"),
        "Une erreur correlee doit terminer la requete");
    Expect(
        !lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"error","context":"rooms.public.list","requestId":"req-1","payload":{"message":"Erreur"}})",
            "req-1",
            "vault.restore"),
        "L'erreur d'une autre requete doit etre ignoree");

    const auto response = lila::shared::network::realtime::protocol::ParseResponse(
        R"({"type":"response.type","requestId":"req-1","success":true,"payload":{"ok":true}})",
        "req-1",
        "response.type");
    Expect(response.type == "response.type", "Type correle attendu");
    Expect(response.success, "Succes attendu");

    const auto errorResponse = lila::shared::network::realtime::protocol::ParseResponse(
        R"({"type":"error","context":"vault.restore","requestId":"req-1","payload":{"message":"Session expiree"}})",
        "req-1",
        "vault.restore");
    Expect(!errorResponse.success, "Echec correle attendu");
    Expect(
        errorResponse.errorKind == lila::shared::network::realtime::RealtimeErrorKind::Server,
        "Erreur serveur attendue");
    Expect(errorResponse.errorMessage == "Session expiree", "Message d'erreur attendu");

    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::network::realtime::protocol::ParseResponse(
            R"({"type":"x","requestId":"req-1","payload":"oops"})",
            "req-1",
            "x"));
    }
    catch (const lila::shared::network::realtime::protocol::RealtimeProtocolError&)
    {
        threw = true;
    }

    Expect(threw, "Payload invalide devait echouer");

    std::cout << "[TEST PASSED] RealtimeProtocolStrictCorrelationAndPayloadValidation\n";
}

void TestChatProtocolHandlesMalformedAndUnknownEvents()
{
    lila::modules::chat::infrastructure::ChatProtocol protocol;

    const auto ignored = protocol.ParseEvent(R"({"type":"social.friend.connected"})", 7, 123);
    Expect(ignored.type == lila::modules::chat::infrastructure::ChatEventType::Ignored, "Evenement inconnu doit etre ignore");

    const auto malformed = protocol.ParseEvent(
        R"({"type":"chat-history","editWindowSeconds":30,"messages":{"bad":true}})",
        7,
        123);
    Expect(malformed.type == lila::modules::chat::infrastructure::ChatEventType::Error, "Historique malforme doit produire une erreur");

    const auto unicode = protocol.ParseEvent(
        "{\"type\":\"chat-message\",\"payload\":{\"id\":\"42\",\"text\":\"caf\xC3\xA9\",\"createdAt\":\"2026-08-20T12:00:00Z\",\"user\":{\"id\":7,\"username\":\"\xC3\xA9lise\"}}}",
        7,
        0);
    Expect(unicode.type == lila::modules::chat::infrastructure::ChatEventType::MessageUpserted, "Message unicode attendu");
    Expect(unicode.messages.size() == 1, "Un message attendu");
    Expect(unicode.messages.front().text == "caf\xC3\xA9", "Texte unicode preserve attendu");

    std::cout << "[TEST PASSED] ChatProtocolHandlesMalformedAndUnknownEvents\n";
}

void TestChatMessageStoreEnforcesLimits()
{
    lila::modules::chat::application::ChatMessageStore store;
    lila::modules::chat::application::ChatMessageStore::Messages messages;
    for (std::size_t index = 0; index < lila::modules::chat::infrastructure::fields::MaxHistoryMessages + 5; ++index)
    {
        lila::modules::chat::domain::ChatMessage message;
        message.id = "m" + std::to_string(index);
        message.text = "text";
        messages.push_back(std::move(message));
    }

    store.LoadHistory(std::move(messages), -12);
    const auto snapshot = store.Snapshot();
    Expect(snapshot.size() == lila::modules::chat::infrastructure::fields::MaxHistoryMessages, "Limite historique attendue");
    Expect(store.EditWindowSeconds() == 0, "Fenetre edition negative doit etre ramenee a zero");
    Expect(snapshot.front().id == "m5", "Les plus anciens messages doivent etre purges");

    std::cout << "[TEST PASSED] ChatMessageStoreEnforcesLimits\n";
}

void TestChatMessageActionRights()
{
    using lila::modules::chat::domain::ChatMessage;
    using lila::modules::chat::presentation::ChatMessageActions;

    constexpr std::time_t nowUtc = 1'000;

    ChatMessage editable;
    editable.id = "m1";
    editable.isMine = true;
    editable.timestampUtc = nowUtc - 10;
    Expect(ChatMessageActions::CanActOnMessage(editable, 30, nowUtc), "Message perso recent doit etre editable");

    ChatMessage expired = editable;
    expired.timestampUtc = nowUtc - 31;
    Expect(!ChatMessageActions::CanActOnMessage(expired, 30, nowUtc), "Message hors fenetre ne doit plus etre editable");

    ChatMessage future = editable;
    future.timestampUtc = nowUtc + 1;
    Expect(!ChatMessageActions::CanActOnMessage(future, 30, nowUtc), "Message futur ne doit pas etre editable");

    ChatMessage foreign = editable;
    foreign.isMine = false;
    Expect(!ChatMessageActions::CanActOnMessage(foreign, 30, nowUtc), "Message tiers ne doit pas etre editable");

    ChatMessage noId = editable;
    noId.id.clear();
    Expect(!ChatMessageActions::CanActOnMessage(noId, 30, nowUtc), "Message sans id ne doit pas etre editable");

    Expect(!ChatMessageActions::CanActOnMessage(editable, 0, nowUtc), "Fenetre nulle doit interdire l'action");

    std::cout << "[TEST PASSED] ChatMessageActionRights\n";
}

void TestActionButtonKeyboardSemantics()
{
    using lila::shared::accessibility::ActionButton;

    Expect(ActionButton::ShouldActivateOnKeyCode(WXK_RETURN), "Entree doit activer le bouton");
    Expect(ActionButton::ShouldActivateOnKeyCode(WXK_SPACE), "Espace doit activer le bouton");
    Expect(!ActionButton::ShouldActivateOnKeyCode(WXK_ESCAPE), "Echap ne doit pas activer le bouton");

    Expect(ActionButton::ShouldPreserveVerticalNavigation(WXK_UP), "Fleche haut doit preservER la navigation");
    Expect(ActionButton::ShouldPreserveVerticalNavigation(WXK_NUMPAD_DOWN), "Fleche bas pave numerique doit preserver la navigation");
    Expect(!ActionButton::ShouldPreserveVerticalNavigation(WXK_TAB), "Tab ne doit pas etre traite comme fleche");
    std::cout << "[TEST PASSED] ActionButtonKeyboardSemantics\n";
}

void TestNavigationControllerKeyboardSemantics()
{
    using Navigator = lila::shared::accessibility::NavigationController;

    Expect(Navigator::IsTabKey(WXK_TAB), "Tab doit etre reconnu");
    Expect(Navigator::IsTabKey(WXK_NUMPAD_TAB), "Tab pave numerique doit etre reconnu");
    Expect(!Navigator::IsTabKey(WXK_DOWN), "Fleche bas ne doit pas etre reconnue comme tab");

    Expect(Navigator::IsVerticalKey(WXK_UP), "Fleche haut doit etre reconnue");
    Expect(Navigator::IsVerticalKey(WXK_NUMPAD_DOWN), "Fleche bas pave numerique doit etre reconnue");
    Expect(!Navigator::IsVerticalKey(WXK_RETURN), "Entree ne doit pas etre reconnue comme verticale");

    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 1,
        "Navigation suivante attendue");
    Expect(
        Navigator::ComputeTargetIndex(3, 2, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 0,
        "Wrap avant attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Backward, Navigator::Boundary::Wrap) == 2,
        "Wrap arriere attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 2, Navigator::Direction::Forward, Navigator::Boundary::Clamp) == 2,
        "Clamp avant attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Backward, Navigator::Boundary::Clamp) == 0,
        "Clamp arriere attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 9, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 0,
        "Index invalide avant doit revenir au debut");
    Expect(
        Navigator::ComputeTargetIndex(3, 9, Navigator::Direction::Backward, Navigator::Boundary::Wrap) == 2,
        "Index invalide arriere doit revenir a la fin");

    std::cout << "[TEST PASSED] NavigationControllerKeyboardSemantics\n";
}
