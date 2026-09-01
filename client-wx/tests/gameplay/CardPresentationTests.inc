void TestOpaqueServerDrivenHandAndShortcuts()
{
    using lila::modules::gameplay::application::cards::GameCardActionResolver;
    using lila::modules::gameplay::infrastructure::GameStatePayloadCodec;
    const auto payload = nlohmann::json{
        {"roomId", 31},
        {"gameType", "opaque-server-game"},
        {"state", {
            {"status", "started"},
            {"phase", "round"},
            {"actions", nlohmann::json::array({
                {{"type", "opaque_play"}, {"label", "Jouer"}, {"payload", {{"value", 2}, {"count", 1}}}},
                {{"type", "opaque_draw"}, {"label", "Piocher"}, {"payload", nlohmann::json::object()}},
                {{"type", "opaque_leave"}, {"label", "Se retirer"}, {"payload", nlohmann::json::object()}},
            })},
            {"extras", {
                {"hand", nlohmann::json::array({
                    {{"id", "2"}, {"label", "2"}, {"actionIndex", 0}},
                    {{"id", "5"}, {"label", "5"}, {"disabled", true}},
                })},
                {"shortcuts", nlohmann::json::array({
                    {{"key", "pressed SPACE"}, {"type", "action"}, {"actionType", "opaque_draw"}},
                    {{"key", "pressed P"}, {"type", "action"}, {"actionType", "opaque_leave"}},
                    {{"key", "pressed C"}, {"type", "interface"}, {"id", "discard"}},
                })},
            }},
        }},
    };

    const auto state = GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    const auto play = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 0);
    Expect(play.has_value() && play->type == "opaque_play" &&
            play->payload.at("value") == 2,
        "Entree doit jouer la carte selectionnee sans connaitre le jeu.");
    Expect(!GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 1).has_value(),
        "Entree ne doit pas jouer une carte desactivee.");
    Expect(state.system.shortcuts.size() == 3 &&
            state.system.shortcuts[0].normalizedKey == "SPACE" &&
            state.system.shortcuts[0].actionType == "opaque_draw",
        "Espace doit rester lie a l'action opaque fournie par le serveur.");
    Expect(state.system.shortcuts[1].normalizedKey == "P" &&
            state.system.shortcuts[1].actionType == "opaque_leave" &&
            state.system.shortcuts[2].normalizedKey == "C" &&
            state.system.shortcuts[2].id == "discard",
        "Les raccourcis d'action et d'interface doivent tous etre conserves.");
    Expect(GameStatePayloadCodec::NormalizeShortcutKey(" pressed RETURN ") == "ENTER",
        "Return doit etre normalise comme Entree.");
    Expect(GameStatePayloadCodec::NormalizeShortcutKey("pressed SHIFT+I") == "SHIFT+I",
        "Les raccourcis modifies propres a un jeu doivent etre conserves.");
}

void TestSpecializedActionsAreNotDuplicated()
{
    using lila::modules::gameplay::application::GameActionPresentationPolicy;
    using lila::modules::gameplay::infrastructure::GameStatePayloadCodec;
    const auto payload = nlohmann::json{
        {"roomId", 41},
        {"gameType", "specialized-actions"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "inspect"}, {"label", "Inspecter"}},
                {{"type", "play_card"}, {"label", "Jouer"}, {"payload", {{"cardId", "wolf"}}}},
                {{"type", "roll_dice"}, {"label", "Lancer"}},
                {{"type", "end_turn"}, {"label", "Terminer"}},
            })},
            {"extras", {
                {"hand", nlohmann::json::array({
                    {{"id", "wolf"}, {"label", "Le loup"}, {"actionIndex", 1}},
                })},
                {"dice", {
                    {"label", "Dé"},
                    {"rollActionIndex", 2},
                    {"dice", nlohmann::json::array({{{"id", "main"}, {"label", "Dé principal"}}})},
                }},
            }},
        }},
    };

    const auto state = GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    const auto lines = GameActionPresentationPolicy::GenericLines(state);
    Expect(lines.empty(),
        "Aucune action ne doit etre affichee en dehors de son controle ou raccourci serveur.");
}

void TestUnmappedSpecializedActionsRemainGeneric()
{
    using lila::modules::gameplay::application::GameActionPresentationPolicy;
    using lila::modules::gameplay::infrastructure::GameStatePayloadCodec;
    const auto payload = nlohmann::json{
        {"roomId", 42},
        {"gameType", "unmapped-specialized-actions"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "play"}, {"payload", {{"cardId", "moon"}}}},
                {{"type", "roll"}, {"label", "Lancer le dé"}},
                {{"type", "pass"}, {"label", "Passer"}},
            })},
            {"extras", {
                {"hand", nlohmann::json::array({
                    {{"id", "moon"}, {"label", "La lune"}},
                })},
                {"dice", {
                    {"label", "Dé"},
                    {"dice", nlohmann::json::array({{{"id", "main"}, {"label", "Dé principal"}}})},
                }},
            }},
        }},
    };

    const auto state = GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    const auto lines = GameActionPresentationPolicy::GenericLines(state);
    Expect(lines.empty(),
        "Une action sans liaison explicite ne doit pas produire de fallback visuel.");
}
