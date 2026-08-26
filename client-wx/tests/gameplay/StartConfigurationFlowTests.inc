void TestStartConfigurationIsSubmittedOnlyOnce()
{
    using lila::modules::gameplay::application::GameStartConfigurationFlow;

    GameStartConfigurationFlow flow;
    Expect(flow.TryBeginSubmission(),
        "La configuration initiale doit pouvoir etre envoyee.");
    Expect(!flow.TryBeginSubmission(),
        "Un second envoi doit etre refuse pendant l'attente de l'acquittement.");
    Expect(!flow.Acknowledge("game.state"),
        "Un acquittement sans rapport ne doit pas demarrer la salle.");
    Expect(flow.Acknowledge("game.actions"),
        "L'acquittement de la configuration doit demander le demarrage de la salle.");
    Expect(flow.IsAwaitingRoomStart(),
        "Apres configuration, le client doit seulement attendre le demarrage de la salle.");
    Expect(!flow.TryBeginSubmission(),
        "La configuration ne doit jamais etre rejouee pendant le demarrage de la salle.");
    Expect(!flow.Acknowledge("game.actions"),
        "Un acquittement duplique ne doit pas redemarrer la salle.");

    flow.Reset();
    Expect(!flow.IsAwaitingActionAcknowledgement() && !flow.IsAwaitingRoomStart(),
        "La confirmation du demarrage doit terminer le flux de configuration.");
}
