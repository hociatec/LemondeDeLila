#include <atomic>
#include <chrono>
#include <condition_variable>
#include <future>
#include <iostream>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>

#include "modules/audio/infrastructure/AsyncAudioBackend.h"

namespace
{
using lila::modules::audio::application::IAudioBackend;
using lila::modules::audio::domain::SoundCue;
using lila::modules::audio::infrastructure::AsyncAudioBackend;

void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

struct BackendState final
{
    std::mutex mutex;
    std::condition_variable ready;
    bool preloadStarted = false;
    bool releasePreload = false;
    bool callActive = false;
    bool concurrentCall = false;
    std::thread::id workerThread;
    int interruptCount = 0;
    int shutdownCount = 0;
};

class CallGuard final
{
public:
    explicit CallGuard(BackendState& state) : state_(state)
    {
        std::scoped_lock lock(state_.mutex);
        if (state_.callActive) state_.concurrentCall = true;
        state_.callActive = true;
        if (state_.workerThread == std::thread::id{})
        {
            state_.workerThread = std::this_thread::get_id();
        }
        else if (state_.workerThread != std::this_thread::get_id())
        {
            state_.concurrentCall = true;
        }
    }

    ~CallGuard()
    {
        std::scoped_lock lock(state_.mutex);
        state_.callActive = false;
    }

private:
    BackendState& state_;
};

class BlockingBackend final : public IAudioBackend
{
public:
    explicit BlockingBackend(std::shared_ptr<BackendState> state) : state_(std::move(state)) {}

    void Preload(SoundCue) override
    {
        CallGuard call(*state_);
        std::unique_lock lock(state_->mutex);
        state_->preloadStarted = true;
        state_->ready.notify_all();
        state_->ready.wait(lock, [this]() { return state_->releasePreload; });
    }

    void Play(SoundCue, float) override {}
    void SetLoop(std::optional<SoundCue>, float) override {}
    void StopAll() override {}

    void InterruptPlayback() noexcept override
    {
        CallGuard call(*state_);
        std::scoped_lock lock(state_->mutex);
        ++state_->interruptCount;
    }

    void Shutdown() noexcept override
    {
        CallGuard call(*state_);
        std::scoped_lock lock(state_->mutex);
        ++state_->shutdownCount;
    }

private:
    std::shared_ptr<BackendState> state_;
};

void TestShutdownKeepsBackendOnWorkerThread()
{
    auto state = std::make_shared<BackendState>();
    AsyncAudioBackend backend(std::make_unique<BlockingBackend>(state));
    backend.Preload(SoundCue::ClientOpened);

    {
        std::unique_lock lock(state->mutex);
        Expect(
            state->ready.wait_for(
                lock,
                std::chrono::seconds(2),
                [&state]() { return state->preloadStarted; }),
            "The worker did not begin the preload command.");
    }

    auto stopping = std::async(std::launch::async, [&backend]()
    {
        backend.InterruptPlayback();
    });
    Expect(
        stopping.wait_for(std::chrono::milliseconds(50)) == std::future_status::timeout,
        "Shutdown should wait for the active worker command.");

    {
        std::scoped_lock lock(state->mutex);
        state->releasePreload = true;
    }
    state->ready.notify_all();
    stopping.get();
    backend.Shutdown();

    std::scoped_lock lock(state->mutex);
    Expect(!state->concurrentCall, "The concrete audio backend was called concurrently.");
    Expect(state->workerThread != std::this_thread::get_id(), "Audio calls ran on the caller thread.");
    Expect(state->interruptCount == 1, "The concrete backend should be interrupted once.");
    Expect(state->shutdownCount == 1, "The concrete backend should be shut down once.");
}
}

int main()
{
    try
    {
        TestShutdownKeepsBackendOnWorkerThread();
        std::cout << "Async audio backend tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Async audio backend test failed: " << error.what() << '\n';
        return 1;
    }
}
