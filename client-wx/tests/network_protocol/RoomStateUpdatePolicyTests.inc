void TestRoomStateUpdatePolicyRejectsPreviousRuns()
{
    using lila::modules::rooms::application::RoomStateUpdatePolicy;
    lila::modules::rooms::domain::RoomState started;
    started.id = 42;
    started.runId = 8;
    started.status = "started";
    started.started = true;

    auto delayedSetup = started;
    delayedSetup.runId = 7;
    delayedSetup.status = "setup";
    delayedSetup.started = false;
    Expect(
        !RoomStateUpdatePolicy::ShouldApply(started, delayedSetup),
        "Un ancien setup ne doit pas desactiver une partie plus recente");

    auto realReset = started;
    realReset.status = "setup";
    realReset.started = false;
    Expect(
        RoomStateUpdatePolicy::ShouldApply(started, realReset),
        "Un reset du run courant doit rester applicable");

    auto nextRun = started;
    nextRun.runId = 9;
    Expect(
        RoomStateUpdatePolicy::ShouldApply(started, nextRun),
        "Le prochain demarrage doit remplacer le run courant");

    auto legacy = delayedSetup;
    legacy.runId = 0;
    Expect(
        RoomStateUpdatePolicy::ShouldApply(started, legacy),
        "Un serveur sans runId doit rester compatible");
}
