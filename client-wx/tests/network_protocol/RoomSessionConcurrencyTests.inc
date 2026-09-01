namespace
{
void TestRoomSessionServiceSerializesOpenTransitions()
{
    FakeRoomSessionGateway gateway;
    gateway.blockCreate = true;
    lila::modules::rooms::application::RoomSessionService service(gateway);

    std::jthread createThread([&service]()
    {
        static_cast<void>(service.Create("four-winds", {}));
    });
    WaitUntil(
        [&gateway]()
        {
            std::scoped_lock lock(gateway.mutex);
            return gateway.createEntered;
        },
        "Creation de table bloquee attendue");

    std::jthread joinThread([&service]()
    {
        static_cast<void>(service.Join(42, false, {}));
    });
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    {
        std::scoped_lock lock(gateway.mutex);
        Expect(gateway.joinCount == 0, "La seconde ouverture ne devait pas chevaucher la creation");
    }

    gateway.ReleaseCreate();
    createThread.join();
    joinThread.join();
    {
        std::scoped_lock lock(gateway.mutex);
        Expect(gateway.createCount == 1, "Une creation attendue");
        Expect(gateway.joinCount == 1, "Une jointure attendue apres la creation");
    }

    service.Close();
    std::cout << "[TEST PASSED] RoomSessionServiceSerializesOpenTransitions\n";
}
}
