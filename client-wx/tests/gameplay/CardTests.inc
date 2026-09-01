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

    auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(BuildGameView(payload));
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
    using lila::modules::gameplay::application::shortcuts::GameGenericShortcutPolicy;
    Expect(GameGenericShortcutPolicy::ResolveInterface(state, "T") == "current-turn",
        "T doit annoncer le tour dans tous les jeux.");
    Expect(GameGenericShortcutPolicy::ResolveInterface(state, "S") == "score",
        "S doit annoncer les scores quand ils sont disponibles.");
    Expect(GameGenericShortcutPolicy::ResolveInterface(state, "E") == "hand",
        "E doit annoncer le nombre de cartes en main.");
    state.system.players.push_back({7, "Lila", false, true});
    state.system.turn.currentPlayerId = 7;
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "current-turn") == "C'est au tour de Lila.",
        "T doit annoncer uniquement le joueur dont c'est le tour.");
    state.kits.score->label = "Jetons";
    state.kits.score->unitSingular = "jeton";
    state.kits.score->unitPlural = "jetons";
    state.kits.score->leaderboard = {{7, 1, 1}};
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "score") == "Lila : 1 jeton\n",
        "S doit annoncer l'unite singuliere fournie par le serveur.");
    state.kits.score->leaderboard = {{7, 12, 1}};
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "score") == "Lila : 12 jetons\n",
        "S doit annoncer l'unite plurielle fournie par le serveur.");
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
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    const auto first = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 0);
    const auto second = GameCardActionResolver::Resolve(state.kits.VisibleHand(), state.actions, 1);
    Expect(first.has_value() && first->payload.at("cardId") == "wolf",
        "Une carte doit executer l'action explicitement associee par le serveur.");
    Expect(second.has_value() && second->type == "play",
        "Deux exemplaires d'une carte doivent conserver deux actions distinctes.");
    const auto sharedActionPayload = nlohmann::json{
        {"roomId", 13}, {"gameType", "duplicate-card-game"},
        {"state", {{"actions", nlohmann::json::array({
            {{"type", "play"}, {"payload", {{"value", 2}}}},
        })}, {"extras", {{"hand", nlohmann::json::array({2, 2})}}}}}};
    const auto sharedActionState = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(
            BuildGameView(sharedActionPayload));
    Expect(GameCardActionResolver::Resolve(
            sharedActionState.kits.VisibleHand(), sharedActionState.actions, 1).has_value(),
        "Une action enumeree par valeur doit jouer chaque exemplaire identique.");
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

    const auto state = GameStatePayloadCodec::DecodeState(BuildGameView(payload));
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
