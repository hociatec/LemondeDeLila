void TestCommandFailuresKeepWorkerAlive()
{
    auto state = std::make_shared<BackendState>();
    state->failPreload = true;
    state->failNextPlay = true;
    AsyncAudioBackend backend(std::make_unique<BlockingBackend>(state));
    backend.Preload(SoundCue::ClientOpened);
    backend.Play(SoundCue::Selection, 0.5F);
    backend.Play(SoundCue::Navigation, 0.5F);
    {
        std::unique_lock lock(state->mutex);
        Expect(state->ready.wait_for(lock, std::chrono::seconds(2),
            [&] { return state->playCount == 1; }),
            "Preload or play failure stopped the audio worker.");
    }
    backend.Shutdown();
}

void TestForegroundQueueIsBoundedAndObservable()
{
    auto state = std::make_shared<BackendState>();
    AsyncAudioBackend backend(std::make_unique<BlockingBackend>(state));
    backend.Preload(SoundCue::ClientOpened);
    {
        std::unique_lock lock(state->mutex);
        Expect(state->ready.wait_for(lock, std::chrono::seconds(2),
            [&] { return state->preloadStarted; }), "Preload did not block the worker.");
    }
    for (int index = 0; index < 300; ++index)
        backend.Play(SoundCue::Selection, 0.5F);
    const auto stats = backend.Stats();
    Expect(stats.foregroundQueued == 256 && stats.foregroundDropped == 44,
        "The audio foreground queue must be bounded and report saturation.");
    {
        std::scoped_lock lock(state->mutex);
        state->releasePreload = true;
    }
    state->ready.notify_all();
    backend.Shutdown();
}
