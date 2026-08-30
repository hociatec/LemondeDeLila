void TestStartConfigurationIsSubmittedOnlyOnce()
{
    using lila::modules::gameplay::application::GameStartConfigurationFlow;

    GameStartConfigurationFlow flow;
    lila::modules::gameplay::domain::GameSetup setup;
    Expect(flow.TryBeginSubmission(setup),
        "La configuration initiale doit pouvoir etre envoyee.");
    Expect(!flow.TryBeginSubmission(setup),
        "Un second envoi doit etre refuse pendant l'attente de l'acquittement.");
    Expect(!flow.Acknowledge("game.state"),
        "Un acquittement sans rapport ne doit pas demarrer la salle.");
    Expect(flow.Acknowledge("game.actions"),
        "L'acquittement de la configuration doit demander le demarrage de la salle.");
    Expect(!flow.IsAwaitingRoomStart(),
        "L'acquittement doit attendre la projection system.setup du serveur.");
    setup.complete = true;
    Expect(flow.ObserveSetup(setup) && flow.IsAwaitingRoomStart(),
        "Le démarrage ne doit être demandé qu'après system.setup.complete.");
    Expect(!flow.TryBeginSubmission(setup),
        "La configuration ne doit jamais etre rejouee pendant le demarrage de la salle.");
    Expect(!flow.Acknowledge("game.actions"),
        "Un acquittement duplique ne doit pas redemarrer la salle.");

    flow.Reset();
    Expect(!flow.IsAwaitingActionAcknowledgement() && !flow.IsAwaitingRoomStart(),
        "La confirmation du demarrage doit terminer le flux de configuration.");
}
