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

void TestShutdownCancelsActiveIo()
{
    auto state = std::make_shared<BackendState>();
    state->cancellablePreload = true;
    AsyncAudioBackend backend(std::make_unique<BlockingBackend>(state));
    backend.Preload(SoundCue::ClientOpened);
    {
        std::unique_lock lock(state->mutex);
        Expect(state->ready.wait_for(lock, std::chrono::seconds(2),
            [&] { return state->preloadStarted; }), "Preload did not start.");
    }
    auto stopped = std::async(std::launch::async, [&] { backend.Shutdown(); });
    const bool cancelled = stopped.wait_for(std::chrono::seconds(1)) == std::future_status::ready;
    if (!cancelled)
    {
        { std::scoped_lock lock(state->mutex); state->releasePreload = true; }
        state->ready.notify_all();
    }
    stopped.get();
    Expect(cancelled, "Shutdown must cancel active audio I/O without waiting for the network timeout.");
    Expect(!state->concurrentCall, "Cancellation must not call BASS from the caller thread.");
}
