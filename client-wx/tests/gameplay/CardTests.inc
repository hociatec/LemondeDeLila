void TestGenericCardsContract()
{
    const auto payload = nlohmann::json{
        {"roomId", 11},
        {"gameType", "card-game"},
        {"state", {{"extras", {
            {"hand", nlohmann::json::array({
                {{"id", "wolf"}, {"label", "Le loup"}},
                {{"id", "moon"}, {"label", "La lune"}, {"description", "Carte nocturne"}},
                {{"id", "unknown"}, {"label", "unknown"}},
            })},
        }}}},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    const auto& hand = state.kits.VisibleHand();
    Expect(hand.size() == 3, "Toutes les cartes de la main doivent etre conservees.");
    Expect(hand[0].id == "wolf" && hand[0].label == "Le loup",
        "Une carte doit recevoir le libelle riche correspondant a son identifiant.");
    Expect(hand[1].description == "Carte nocturne",
        "La description generique d'une carte doit etre conservee.");
    Expect(lila::modules::gameplay::application::cards::GameCardTextBuilder::AccessibleText(hand[1]) ==
            "La lune. Carte nocturne",
        "La description d'une carte doit etre disponible au lecteur d'ecran.");
    Expect(hand[2].label == "unknown",
        "Une carte inconnue doit rester utilisable avec son identifiant comme libelle.");
}

void TestCardsCarryTheirActionsAcrossGames()
{
    using lila::modules::gameplay::application::cards::GameCardActionResolver;
    const auto payload = nlohmann::json{
        {"roomId", 12},
        {"gameType", "generic-card-game"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "inspect"}, {"payload", nlohmann::json::object()}},
                {{"type", "play"}, {"payload", {{"cardId", "wolf"}}}},
                {{"type", "play"}, {"payload", {{"cardId", "wolf"}}}},
            })},
            {"extras", {{"hand", nlohmann::json::array({
                {{"id", "wolf"}, {"label", "Le loup"}, {"actionIndex", 1}},
                {{"id", "wolf"}, {"label", "Le second loup"}, {"actionIndex", 2}},
                {{"id", "moon"}, {"label", "La lune"}, {"disabled", true}},
                {{"id", "wolf"}, {"label", "Le loup jouable"}, {"disabled", true}, {"actionIndex", 1}},
                {{"id", "wolf"}, {"label", "Le loup consultable"}, {"disabled", true}},
            })}}},
        }},
    };
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    const auto first = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 0);
    const auto second = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 1);
    Expect(first.has_value() && first->payload.at("cardId") == "wolf",
        "Une carte doit executer l'action explicitement associee par le serveur.");
    Expect(second.has_value() && second->type == "play",
        "Deux exemplaires d'une carte doivent conserver deux actions distinctes.");
    Expect(!GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 2).has_value(),
        "Une carte desactivee doit rester consultable sans etre jouable.");
    Expect(GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 3).has_value(),
        "Une action serveur disponible doit primer sur un indicateur visuel de carte obsolete.");
    Expect(!GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 4).has_value(),
        "Une carte desactivee sans liaison ne doit pas recuperer une autre action par similitude de payload.");
}

void TestServerDrivenKeyboardActionsSurviveTheClientContract()
{
    using lila::modules::gameplay::application::cards::GameCardActionResolver;
    using lila::modules::gameplay::infrastructure::GameStatePayloadCodec;
    const auto payload = nlohmann::json{
        {"roomId", 21},
        {"gameType", "server-driven-card-game"},
        {"state", {
            {"status", "started"},
            {"phase", "round"},
            {"actions", nlohmann::json::array({
                {{"type", "play_card"}, {"payload", {{"value", 2}, {"count", 1}}}},
                {{"type", "draw_card"}, {"payload", nlohmann::json::object()}},
                {{"type", "end_turn"}, {"payload", nlohmann::json::object()}},
            })},
            {"extras", {
                {"hand", nlohmann::json::array({
                    {{"id", "2"}, {"label", "2"}, {"actionIndex", 0}},
                })},
                {"shortcuts", nlohmann::json::array({
                    {{"key", "SPACE"}, {"type", "action"}, {"actionType", "draw_card"}},
                    {{"key", "P"}, {"type", "action"}, {"actionType", "end_turn"}},
                })},
            }},
        }},
    };

    const auto state = GameStatePayloadCodec::DecodeState(V2Payload(payload));
    const auto play = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 0);
    Expect(play.has_value() && play->type == "play_card",
        "Entree sur une carte doit retrouver l'action associee par le serveur.");
    Expect(state.system.shortcuts.size() == 2 &&
            state.system.shortcuts[0].normalizedKey == "SPACE" &&
            state.system.shortcuts[0].actionType == "draw_card",
        "Espace doit rester associe a l'action fournie par le serveur.");
    Expect(state.system.shortcuts[1].normalizedKey == "P" &&
            state.system.shortcuts[1].actionType == "end_turn",
        "P doit rester associe a l'action de fin de tour exposee par le serveur.");

    const auto encoded = lila::modules::gameplay::infrastructure::GameCommandPayloadCodec::EncodeAction(
        {21, "server-driven-card-game", "command-123", state.version, {*play}});
    Expect(encoded.at("actions").at(0).at("type") == "play_card" &&
            encoded.at("actions").at(0).at("payload").at("value") == 2,
        "L'action de carte doit etre envoyee sans perdre son type ni sa valeur.");
    Expect(encoded.at("commandId") == "command-123" &&
            encoded.at("knownVersion") == state.version,
        "La commande doit conserver son identite et la version connue.");
}

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

    const auto state = GameStatePayloadCodec::DecodeState(V2Payload(payload));
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

    const auto state = GameStatePayloadCodec::DecodeState(V2Payload(payload));
    const auto lines = GameActionPresentationPolicy::GenericLines(state);
    Expect(lines.size() == 2,
        "Les actions liees a la main et aux des ne doivent pas etre affichees une seconde fois.");
    Expect(lines[0].actionIndex == 0 && lines[1].actionIndex == 3,
        "La liste generique doit conserver uniquement les actions sans controle specialise.");
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

    const auto state = GameStatePayloadCodec::DecodeState(V2Payload(payload));
    const auto lines = GameActionPresentationPolicy::GenericLines(state);
    Expect(lines.size() == 2 && lines[0].actionIndex == 1 && lines[1].actionIndex == 2,
        "Sans liaison explicite du kit, les actions inconnues doivent rester utilisables via GameLine.");
}
