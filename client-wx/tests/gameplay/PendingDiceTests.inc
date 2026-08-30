void TestPendingChoicesUseOnlyExplicitServerMappings()
{
    const auto payload = nlohmann::json{
        {"roomId", 32},
        {"gameType", "opaque-choice-game"},
        {"state", {
            {"round", 3},
            {"botThinking", true},
            {"metadata", {{"lifecycle", {{"viewerTurnActionable", true}}}}},
            {"extras", {{"viewerPlayerId", 17}}},
            {"pending", {
                {"type", "opaque_choice"},
                {"label", "Choisissez une option."},
                {"playerId", "17"},
                {"choices", nlohmann::json::array({"Alpha", "Beta"})},
                {"data", {{"choiceActionsByIndex", nlohmann::json::array({
                    {{"type", "opaque_alpha"}, {"payload", {{"value", 1}}}},
                    {{"type", "opaque_beta"}, {"payload", {{"value", 2}}}},
                })}}},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.pending.has_value(), "Le pending generique doit etre conserve.");
    Expect(state.pending->viewerActionable && state.pending->choices.size() == 2,
        "Les choix destines au viewer doivent rester interactifs.");
    Expect(state.pending->choices[1].action.has_value() &&
            state.pending->choices[1].action->type == "opaque_beta" &&
            state.pending->choices[1].action->payload.at("value") == 2,
        "Un choix doit executer uniquement son mapping explicite fourni par le serveur.");
    Expect(state.round == 3,
        "Le résumé générique doit conserver la manche du contrat system.round.");
}

void TestPendingChoicesStayPassiveWithoutServerMapping()
{
    const auto payload = nlohmann::json{
        {"roomId", 33},
        {"gameType", "opaque-choice-game"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "looks_related"}, {"payload", {{"choiceIndex", 0}}}},
            })},
            {"pending", {
                {"type", "opaque_choice"},
                {"choices", nlohmann::json::array({"Alpha"})},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.pending.has_value() && !state.pending->viewerActionable,
        "Le client ne doit pas deduire un choix interactif depuis la liste d'actions.");
    Expect(!state.pending->choices[0].action.has_value(),
        "Sans choiceActionsByIndex, aucune action ne doit etre inventee.");
}

void TestGenericDiceContract()
{
    using lila::modules::gameplay::application::dice::GameDiceActionResolver;
    const auto payload = nlohmann::json{
        {"roomId", 14},
        {"gameType", "generic-dice-game"},
        {"state", {
            {"turnIndex", 6},
            {"actions", nlohmann::json::array({
                {{"type", "inspect"}, {"payload", nlohmann::json::object()}},
                {{"type", "server-specific-roll"}, {"payload", {{"mode", "fast"}}}},
            })},
            {"extras", {{"dice", {
                {"label", "Dés de course"},
                {"total", 8},
                {"rollKey", "round-2-roll-4"},
                {"rollActionIndex", 1},
                {"dice", nlohmann::json::array({
                    {{"id", "red"}, {"label", "Dé rouge"}, {"sides", 8}, {"value", 3}},
                    {{"id", "blue"}, {"label", "Dé bleu"}, {"sides", 8}, {"value", 5}},
                })},
            }}}},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.dice.has_value() && state.dice->dice.size() == 2,
        "Tous les des fournis par le serveur doivent etre conserves.");
    Expect(state.dice->total == 8 && state.dice->dice[1].value == 5,
        "Les valeurs individuelles et le total doivent etre decodes.");
    const auto action = GameDiceActionResolver::Resolve(*state.dice, state.actions, 0);
    Expect(action.has_value() && action->type == "server-specific-roll",
        "Le lancer doit utiliser l'index serveur sans connaitre le nom de l'action.");
    Expect(lila::modules::gameplay::application::dice::GameDiceTextBuilder::DieText(
            state.dice->dice[0]) == "Dé rouge : 3 sur 8",
        "La valeur et le nombre de faces doivent former un texte accessible.");
}

void TestClassicRollActionContract()
{
    const auto payload = nlohmann::json{
        {"roomId", 16},
        {"gameType", "classic-board-game"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "ROLL_DICE"}, {"payload", nlohmann::json::object()}},
                {{"type", "roll"}, {"disabled", true}, {"payload", nlohmann::json::object()}},
            })},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.lines.size() == 2 && state.lines.front().label.find("ROLL_DICE") != std::string::npos,
        "Une action inconnue du panneau de dés doit rester utilisable via GameLine.");
}

void TestDiceRollTracker()
{
    using lila::modules::gameplay::application::dice::GameDiceRollTracker;
    lila::modules::gameplay::domain::GameDiceState dice;
    dice.total = 4;
    dice.rollKey = "roll-1";
    GameDiceRollTracker tracker;
    Expect(!tracker.Observe(dice, 1), "Le premier etat de de ne doit pas jouer de son.");
    Expect(!tracker.Observe(dice, 1), "Un etat identique ne doit pas rejouer le son.");
    dice.rollKey = "roll-2";
    Expect(tracker.Observe(dice, 1),
        "Deux lancers identiques doivent rester distincts grace a la cle serveur.");
}
