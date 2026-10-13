#pragma once
#include <stop_token>
#include <string>
namespace lila::modules::about::application
{
class IAdminContactSender
{
public:
    virtual ~IAdminContactSender() = default;
    virtual void Send(const std::string& message, std::stop_token stopToken) const = 0;
};
}
