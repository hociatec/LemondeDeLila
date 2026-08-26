void TestAsyncRequestSlotRejectsStaleCompletion()
{
    lila::shared::concurrency::AsyncRequestSlot slot;
    const auto staleToken = slot.CurrentToken();
    auto staleSource = std::make_shared<std::stop_source>();
    auto staleTask = std::make_shared<lila::shared::concurrency::BackgroundTaskHandle>(staleSource);
    slot.Track(staleTask);
    slot.Cancel();

    Expect(staleTask->IsCancellationRequested(), "Requete precedente annulee attendue");
    Expect(!slot.Complete(staleToken), "Completion obsolete rejetee attendue");

    const auto currentToken = slot.CurrentToken();
    auto currentSource = std::make_shared<std::stop_source>();
    auto currentTask = std::make_shared<lila::shared::concurrency::BackgroundTaskHandle>(currentSource);
    slot.Track(currentTask);
    Expect(slot.Complete(currentToken), "Completion courante acceptee attendue");
    Expect(!currentTask->IsCancellationRequested(), "Requete terminee non annulee attendue");

    std::cout << "[TEST PASSED] AsyncRequestSlotRejectsStaleCompletion\n";
}

void TestSingleFlightCacheSharesLoadsAndSupportsInvalidation()
{
    lila::shared::cache::SingleFlightCache<int> cache;
    std::atomic<int> loadCount = 0;
    std::promise<void> loaderStarted;
    std::promise<void> releaseLoader;
    auto releaseFuture = releaseLoader.get_future().share();

    auto first = std::async(
        std::launch::async,
        [&]()
        {
            return cache.GetOrLoad(
                {},
                [&](std::stop_token)
                {
                    ++loadCount;
                    loaderStarted.set_value();
                    releaseFuture.wait();
                    return 42;
                });
        });
    loaderStarted.get_future().wait();
    auto second = std::async(
        std::launch::async,
        [&]()
        {
            return cache.GetOrLoad(
                {},
                [&](std::stop_token)
                {
                    ++loadCount;
                    return 99;
                });
        });

    releaseLoader.set_value();
    Expect(first.get() == 42, "Premiere valeur chargee attendue");
    Expect(second.get() == 42, "Chargement concurrent partage attendu");
    Expect(loadCount == 1, "Un seul chargement du cache attendu");
    Expect(cache.TryGet() == 42, "Lecture instantanee du cache attendue");

    cache.Clear();
    const auto refreshed = cache.GetOrLoad(
        {},
        [&](std::stop_token)
        {
            ++loadCount;
            return 7;
        });
    Expect(refreshed == 7 && loadCount == 2, "Rechargement apres invalidation attendu");

    std::cout << "[TEST PASSED] SingleFlightCacheSharesLoadsAndSupportsInvalidation\n";
}

