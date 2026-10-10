void TestRoomInvitationResponses()
{
    using namespace lila::shared::network::realtime;
    using lila::modules::rooms::infrastructure::ReadRoomInvitationResponse;
    const std::vector<std::string> alternatives{"room.lobby.invite.accepted"};
    for (const bool spectator : {false, true})
    {
        const auto raw = nlohmann::json{
            {"type", "room.lobby.invite.accepted"}, {"requestId", "invite-1"},
            {"payload", {{"roomId", 42}, {"spectator", spectator}}}}.dump();
        Expect(protocol::IsResponseForRequest(raw, "invite-1", "room.lobby.invite.respond",
            "room.lobby.invite.responded", alternatives), "Accepted invitation must complete the request");
        Expect(!protocol::IsResponseForRequest(raw, "other", "room.lobby.invite.respond",
            "room.lobby.invite.responded", alternatives), "Other requests must remain ignored");
        Expect(!protocol::IsResponseForRequest(raw, "invite-1", "room.lobby.invite.respond",
            "room.lobby.invite.responded"), "Alternate responses require explicit opt-in");
        const auto response = protocol::ParseResponse(raw, "invite-1", "room.lobby.invite.respond",
            "room.lobby.invite.responded", alternatives);
        Expect(response.success, "Invitation response must succeed");
        const auto target = ReadRoomInvitationResponse(response.type, response.payload, true);
        Expect(target.roomId == 42 && target.spectator == spectator, "Use the server room and role");
    }
    Expect(!protocol::IsResponseForRequest(
        R"({"type":"room.lobby.invite.accepted","payload":{"roomId":42,"spectator":false}})",
        "invite-1", "room.lobby.invite.respond", "room.lobby.invite.responded", alternatives),
        "Unsolicited notifications cannot complete an invitation request");
    const auto declined = ReadRoomInvitationResponse("room.lobby.invite.responded", {{"accepted", false}}, false);
    Expect(declined.roomId == 0, "Declining must not join a room");
    for (const auto& payload : std::vector<nlohmann::json>{
        {{"expired", true}, {"accepted", false}}, {{"accepted", false}},
        {{"roomId", 0}, {"spectator", false}}, {{"roomId", 42}}, nullptr})
    {
        bool failed = false;
        try { static_cast<void>(ReadRoomInvitationResponse("room.lobby.invite.accepted", payload, true)); }
        catch (const std::exception&) { failed = true; }
        Expect(failed, "Expired or invalid invitations must report an error without joining");
    }
    bool expired = false;
    try { static_cast<void>(ReadRoomInvitationResponse("room.lobby.invite.responded", {{"expired", true}}, true)); }
    catch (const std::exception&) { expired = true; }
    Expect(expired, "Expired response must not open the original room");
}
