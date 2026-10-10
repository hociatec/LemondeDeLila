namespace lila::modules::social::presentation
{
struct SocialReadSchedulingTest
{
    static void Run(application::SocialService& service)
    {
        lila::shared::concurrency::BackgroundExecutor executor({2, 16});
        lila::shared::concurrency::InstallBackgroundExecutor(executor);
        auto* host = new wxFrame(nullptr, wxID_ANY, "Read scheduling");
        auto* frame = new SocialFrame(host, service, {}, {}, {}, {});
        std::mutex mutex;
        std::condition_variable wake;
        bool released = false;
        std::atomic<int> obsoleteWork = 0, latestWork = 0, writes = 0;
        int obsoleteApplied = 0, latestApplied = 0, writesApplied = 0;
        const auto slow = [&]
        {
            std::unique_lock lock(mutex);
            wake.wait(lock, [&] { return released; });
        };
        const auto release = [&]
        {
            { std::lock_guard lock(mutex); released = true; }
            wake.notify_all();
        };
        const auto wait = [&]
        {
            const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
            while ((frame->isBusy_ || frame->pendingRead_) && std::chrono::steady_clock::now() < deadline)
            { wxYield(); std::this_thread::sleep_for(std::chrono::milliseconds(1)); }
            assert(!frame->isBusy_ && !frame->pendingRead_);
        };
        frame->RunBackgroundTask("read", slow, [&] { ++obsoleteApplied; }, false, true);
        frame->RunBackgroundTask("read", [&] { ++obsoleteWork; }, [&] { ++obsoleteApplied; }, false, true);
        frame->RunBackgroundTask("read", [&] { ++latestWork; }, [&] { ++latestApplied; }, false, true);
        release();
        wait();
        assert(obsoleteWork == 0 && obsoleteApplied == 0);
        assert(latestWork == 1 && latestApplied == 1);

        // A queued read must survive a failing superseded read.
        { std::lock_guard lock(mutex); released = false; }
        frame->RunBackgroundTask("read", [&] { slow(); throw std::runtime_error("old read failed"); },
            {}, false, true);
        frame->RunBackgroundTask("read", [&] { ++latestWork; }, [&] { ++latestApplied; }, false, true);
        release();
        wait();
        assert(latestWork == 2 && latestApplied == 2);

        // Reads wait for writes; neither duplicate writes nor stale completions run.
        { std::lock_guard lock(mutex); released = false; }
        frame->RunBackgroundTask("write", [&] { slow(); ++writes; }, [&] { ++writesApplied; });
        frame->RunBackgroundTask("read", [&] { ++latestWork; }, [&] { ++latestApplied; }, false, true);
        frame->RunBackgroundTask("write", [&] { ++writes; });
        release();
        wait();
        assert(writes == 1 && writesApplied == 1);
        assert(latestWork == 3 && latestApplied == 3);

        // A response received after leaving the screen cannot restore it.
        { std::lock_guard lock(mutex); released = false; }
        frame->RunBackgroundTask("read", slow, [&] { ++obsoleteApplied; }, false, true);
        ++frame->readGeneration_;
        frame->pendingRead_ = {};
        release();
        wait();
        assert(obsoleteApplied == 0);
        delete host;
        executor.Shutdown();
        lila::shared::concurrency::UninstallBackgroundExecutor();
    }
};
}
