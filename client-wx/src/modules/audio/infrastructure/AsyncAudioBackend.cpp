#include "modules/audio/infrastructure/AsyncAudioBackend.h"

#include <algorithm>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <utility>

namespace lila::modules::audio::infrastructure
{
namespace
{
enum class CommandType { Preload, Play, SetLoop, StopAll };

struct Command final
{
    CommandType type;
    std::optional<domain::SoundCue> cue;
    float volume = 0.0F;
};

constexpr std::size_t MaximumForegroundCommands = 256;

std::unique_ptr<application::IAudioBackend> RequireBackend(
    std::unique_ptr<application::IAudioBackend> backend)
{
    if (backend == nullptr)
    {
        throw std::invalid_argument("Audio backend is required.");
    }
    return backend;
}
}

class AsyncAudioBackend::Impl final
{
public:
    explicit Impl(std::unique_ptr<application::IAudioBackend> backend)
        : backend_(RequireBackend(std::move(backend))), worker_([this]() { Run(); })
    {
    }

    ~Impl()
    {
        Shutdown();
    }

    void EnqueueBackground(Command command)
    {
        std::scoped_lock lock(mutex_);
        if (!stopping_)
        {
            background_.push_back(command);
            ready_.notify_one();
        }
    }

    void EnqueueForeground(Command command)
    {
        std::scoped_lock lock(mutex_);
        if (stopping_)
        {
            return;
        }
        if (command.type == CommandType::SetLoop)
        {
            std::erase_if(foreground_, [](const Command& queued)
            {
                return queued.type == CommandType::SetLoop;
            });
        }
        if (foreground_.size() >= MaximumForegroundCommands)
        {
            foreground_.pop_front();
        }
        foreground_.push_back(command);
        ready_.notify_one();
    }

    void Interrupt() noexcept
    {
        // The wrapped backend belongs exclusively to the worker thread.  In
        // particular, BASS must not be interrupted from the UI thread while
        // the worker is preloading or starting another sound.
        Shutdown();
    }

    void Shutdown() noexcept
    {
        {
            std::scoped_lock lock(mutex_);
            if (stopping_)
            {
                return;
            }
            stopping_ = true;
            foreground_.clear();
            background_.clear();
        }
        ready_.notify_all();
        if (worker_.joinable())
        {
            worker_.join();
        }
    }

private:
    void Run() noexcept
    {
        while (true)
        {
            std::optional<Command> command;
            {
                std::unique_lock lock(mutex_);
                ready_.wait(lock, [this]()
                {
                    return stopping_ || !foreground_.empty() || !background_.empty();
                });
                if (stopping_)
                {
                    break;
                }
                auto& queue = foreground_.empty() ? background_ : foreground_;
                command = queue.front();
                queue.pop_front();
            }
            try
            {
                Execute(*command);
            }
            catch (...)
            {
                // An audio failure must never terminate the application or the worker.
            }
        }
        // All calls into the concrete backend, including teardown, stay on a
        // single thread. This avoids racing BASS_Free/BASS_Stop with a call in
        // progress.
        backend_->InterruptPlayback();
        backend_->Shutdown();
    }

    void Execute(const Command& command) noexcept
    {
        switch (command.type)
        {
        case CommandType::Preload: backend_->Preload(*command.cue); break;
        case CommandType::Play: backend_->Play(*command.cue, command.volume); break;
        case CommandType::SetLoop: backend_->SetLoop(command.cue, command.volume); break;
        case CommandType::StopAll: backend_->StopAll(); break;
        }
    }

    std::unique_ptr<application::IAudioBackend> backend_;
    std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<Command> foreground_;
    std::deque<Command> background_;
    // This state must be constructed before worker_: a newly-created thread
    // is allowed to run immediately from worker_'s constructor.
    bool stopping_ = false;
    std::thread worker_;
};

AsyncAudioBackend::AsyncAudioBackend(std::unique_ptr<application::IAudioBackend> backend)
    : impl_(std::make_unique<Impl>(std::move(backend)))
{
}

AsyncAudioBackend::~AsyncAudioBackend() = default;

void AsyncAudioBackend::Preload(domain::SoundCue cue)
{
    impl_->EnqueueBackground({CommandType::Preload, cue});
}

void AsyncAudioBackend::Play(domain::SoundCue cue, float volume)
{
    impl_->EnqueueForeground({CommandType::Play, cue, volume});
}

void AsyncAudioBackend::SetLoop(std::optional<domain::SoundCue> cue, float volume)
{
    impl_->EnqueueForeground({CommandType::SetLoop, cue, volume});
}

void AsyncAudioBackend::StopAll()
{
    impl_->EnqueueForeground({CommandType::StopAll, std::nullopt});
}

void AsyncAudioBackend::InterruptPlayback() noexcept
{
    impl_->Interrupt();
}

void AsyncAudioBackend::Shutdown() noexcept
{
    impl_->Shutdown();
}
}
