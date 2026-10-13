#pragma once
#include <stop_token>
#include "modules/shortcuts/domain/Shortcut.h"
namespace lila::modules::shortcuts::application
{
class IShortcutGateway
{
public:
    virtual ~IShortcutGateway() = default;
    virtual domain::ShortcutSnapshot Cached(int userId) const = 0;
    virtual domain::ShortcutSnapshot Load(int userId, std::stop_token stop) const = 0;
    virtual domain::ShortcutSnapshot Save(int userId, const domain::ShortcutSnapshot& value, std::stop_token stop) const = 0;
};
}
