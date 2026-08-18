#pragma once

#include <functional>
#include <string>

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::modules::messaging::presentation
{
class MessagingActionController final
{
public:
    enum class Mutation
    {
        Delete,
        Restore,
        Purge,
    };

    struct Callbacks final
    {
        std::function<void(const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)> runTask;
        std::function<bool(const char* confirmationMessage, bool warning)> confirm;
        std::function<void(const char* message)> showFeedback;
        std::function<void()> refreshCurrentBox;
    };

    MessagingActionController(application::MessagingService& service, Callbacks callbacks);

    void Mutate(Mutation mutation, const std::string& messageId) const;
    void MarkRead(const std::string& messageId) const;

private:
    application::MessagingService& service_;
    Callbacks callbacks_;
};
}
