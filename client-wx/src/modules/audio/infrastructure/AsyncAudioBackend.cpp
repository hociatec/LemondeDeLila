#include "modules/audio/infrastructure/AsyncAudioBackend.h"
#include "modules/audio/infrastructure/AudioCommand.h"
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <utility>

#include "shared/logging/application/Logger.h"

namespace lila::modules::audio::infrastructure
{
namespace
{
using detail::Command, detail::CommandType, detail::RequireBackend;

constexpr std::size_t MaximumForegroundCommands = 256;
constexpr std::size_t MaximumBackgroundCommands = 256;

}

class AsyncAudioBackend::Impl final
{
public:
    explicit Impl(std::unique_ptr<application::IAudioBackend> backend)
        : backend_(RequireBackend(std::move(backend))), worker_([this]() { Run(); })
    {
    }

    ~Impl() { Shutdown(); }

    void EnqueueBackground(Command command)
    {
        std::scoped_lock lock(mutex_);
        if (!stopping_)
        {
            const auto duplicate = std::find_if(background_.begin(), background_.end(),
                [&command](const Command& queued)
                {
                    return queued.type == command.type && queued.cue == command.cue;
                });
            if (duplicate != background_.end()) return;
            if (background_.size() >= MaximumBackgroundCommands)
            {
                ++backgroundDropped_;
                if (backgroundDropped_ == 1 || backgroundDropped_ % 64 == 0)
                    lila::shared::logging::LogWarning(
                        "AsyncAudio", "Background audio queue saturated; preload rejected.");
                return;
            }
            background_.push_back(command);
            ready_.notify_one();
        }
    }

    void EnqueueForeground(Command command)
    {
        std::scoped_lock lock(mutex_);
        if (stopping_) return;
        if (command.type == CommandType::SetLoop || command.type == CommandType::Preview || command.type == CommandType::StopAll)
            operationStop_.request_stop();
        if (command.type == CommandType::SetLoop || command.type == CommandType::Preview || command.type == CommandType::RefreshAssets)
        {
            std::erase_if(foreground_, [&command](const Command& queued)
            {
                return queued.type == command.type;
            });
        }
        if (foreground_.size() >= MaximumForegroundCommands)
        {
            ++foregroundDropped_;
            foreground_.pop_front();
            if (foregroundDropped_ == 1 || foregroundDropped_ % 64 == 0)
                lila::shared::logging::LogWarning(
                    "AsyncAudio", "Foreground audio queue saturated; oldest cue replaced.");
        }
        foreground_.push_back(command);
        ready_.notify_one();
    }

    [[nodiscard]] AsyncAudioQueueStats Stats() const
    {
        std::scoped_lock lock(mutex_);
        return {foreground_.size(), background_.size(), foregroundDropped_, backgroundDropped_};
    }

    void Interrupt() noexcept
    {
        Shutdown();
    }

    void Shutdown(bool graceful = false) noexcept
    {
        {
            std::scoped_lock lock(mutex_);
            if (stopping_)
            {
                return;
            }
            stopping_ = true;
            operationStop_.request_stop();
            graceful_ = graceful;
            if (!graceful) foreground_.clear();
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
        bool pumpDeferredPlayback = false;
        while (true)
        {
            std::optional<Command> command;
            {
                std::unique_lock lock(mutex_);
                const auto readyToProcess = [this]()
                {
                    return stopping_ || !foreground_.empty() || !background_.empty();
                };
                if (pumpDeferredPlayback && foreground_.empty() && background_.empty())
                {
                    ready_.wait_for(lock, std::chrono::milliseconds(10), readyToProcess);
                }
                else
                {
                    ready_.wait(lock, readyToProcess);
                }
                if (stopping_ && (!graceful_ || foreground_.empty()))
                {
                    break;
                }
                if (!foreground_.empty() || !background_.empty())
                {
                    auto& queue = foreground_.empty() ? background_ : foreground_;
                    command = queue.front();
                    queue.pop_front();
                    operationStop_ = std::stop_source{};
                    if (stopping_) operationStop_.request_stop();
                }
            }
            try
            {
                if (command.has_value()) Execute(*command);
                pumpDeferredPlayback = backend_->PumpDeferredPlayback();
            }
            catch (const std::exception& error)
            {
                auto detail = std::string(error.what()).substr(0, 256);
                lila::shared::logging::LogWarning(
                    "AsyncAudio", "Audio command failed: " + detail);
            }
            catch (...)
            {
                lila::shared::logging::LogWarning(
                    "AsyncAudio", "Audio command failed with an unknown error.");
            }
        }
        // All calls into the concrete backend, including teardown, stay on a
        // single thread. This avoids racing BASS_Free/BASS_Stop with a call in
        // progress.
        if (graceful_)
        {
            try { backend_->FinishPlayback(); }
            catch (const std::exception& error)
            {
                lila::shared::logging::LogWarning("AsyncAudio",
                    "Audio drain failed: " + std::string(error.what()).substr(0, 256));
            }
            catch (...)
            { lila::shared::logging::LogWarning(
                "AsyncAudio", "Audio drain failed with an unknown error."); }
        }
        backend_->InterruptPlayback();
        backend_->Shutdown();
    }

    void Execute(const Command& command)
    {
        backend_->SetOperationStopToken(operationStop_.get_token());
        switch (command.type)
        {
        case CommandType::Preload: backend_->Preload(*command.cue); break;
        case CommandType::Play: backend_->Play(*command.cue, command.volume); break;
        case CommandType::Preview: backend_->Preview(command.cue, command.volume); break;
        case CommandType::SetPreviewVolume: backend_->SetPreviewVolume(command.volume); break;
        case CommandType::TogglePreviewPause: backend_->TogglePreviewPause(); break;
        case CommandType::SetLoop: backend_->SetLoop(command.cue, command.volume); break;
        case CommandType::StopAll: backend_->StopAll(); break;
        case CommandType::RefreshAssets: backend_->RefreshAssets(); break;
        }
    }

    std::unique_ptr<application::IAudioBackend> backend_;
    mutable std::mutex mutex_;
    std::condition_variable ready_;
    std::deque<Command> foreground_;
    std::deque<Command> background_;
    bool stopping_ = false;
    bool graceful_ = false;
    std::size_t foregroundDropped_ = 0;
    std::size_t backgroundDropped_ = 0;
    std::stop_source operationStop_;
    std::thread worker_;
};

AsyncAudioBackend::AsyncAudioBackend(std::unique_ptr<application::IAudioBackend> backend)
    : impl_(std::make_unique<Impl>(std::move(backend))) {}
AsyncAudioBackend::~AsyncAudioBackend() = default;
void AsyncAudioBackend::Preload(domain::SoundCue cue)
{ impl_->EnqueueBackground({CommandType::Preload, cue}); }
void AsyncAudioBackend::Play(domain::SoundCue cue, float volume)
{ impl_->EnqueueForeground({CommandType::Play, cue, volume}); }
void AsyncAudioBackend::SetLoop(std::optional<domain::SoundCue> cue, float volume)
{ impl_->EnqueueForeground({CommandType::SetLoop, cue, volume}); }
void AsyncAudioBackend::Preview(std::optional<domain::SoundCue> cue) { Preview(cue, 1.0F); }
void AsyncAudioBackend::Preview(std::optional<domain::SoundCue> cue, float volume)
{ impl_->EnqueueForeground({CommandType::Preview, cue, volume}); }
void AsyncAudioBackend::SetPreviewVolume(float volume)
{ impl_->EnqueueForeground({CommandType::SetPreviewVolume, std::nullopt, volume}); }
void AsyncAudioBackend::TogglePreviewPause()
{ impl_->EnqueueForeground({CommandType::TogglePreviewPause, std::nullopt}); }
void AsyncAudioBackend::StopAll()
{ impl_->EnqueueForeground({CommandType::StopAll, std::nullopt}); }
void AsyncAudioBackend::RefreshAssets()
{ impl_->EnqueueForeground({CommandType::RefreshAssets, std::nullopt}); }
void AsyncAudioBackend::ShutdownGracefully() noexcept
{ impl_->Shutdown(true); }
void AsyncAudioBackend::InterruptPlayback() noexcept
{ impl_->Interrupt(); }
void AsyncAudioBackend::Shutdown() noexcept
{ impl_->Shutdown(); }
AsyncAudioQueueStats AsyncAudioBackend::Stats() const
{ return impl_->Stats(); }
}
