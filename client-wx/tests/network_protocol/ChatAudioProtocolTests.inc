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
    Expect(!unicode.isEdit, "Un nouveau message ne doit pas etre une edition");
    const auto edited = protocol.ParseEvent(
        R"({"type":"chat-message.updated","payload":{"id":"42","text":"edited","createdAt":"2026-09-24T10:00:00Z","user":{"id":8,"username":"Bob"}}})", 7, 123);
    Expect(edited.isEdit, "Une edition doit etre identifiee pour rester silencieuse");
    Expect(unicode.messages.size() == 1, "Un message attendu");
    Expect(unicode.messages.front().text == "caf\xC3\xA9", "Texte unicode preserve attendu");

    std::cout << "[TEST PASSED] ChatProtocolHandlesMalformedAndUnknownEvents\n";
}
