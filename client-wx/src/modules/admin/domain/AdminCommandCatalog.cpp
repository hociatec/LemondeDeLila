#include "modules/admin/domain/AdminCommand.h"

namespace lila::modules::admin::domain
{
void AppendModerationCommands(std::vector<AdminCommand>& commands);
void AppendContentCommands(std::vector<AdminCommand>& commands);
void AppendOperationsCommands(std::vector<AdminCommand>& commands);

const std::vector<AdminCommand>& GetAdminCommands()
{
    static const auto commands = []
    {
        std::vector<AdminCommand> result;
        AppendModerationCommands(result);
        AppendContentCommands(result);
        AppendOperationsCommands(result);
        return result;
    }();
    return commands;
}

const AdminCommand* FindAdminCommand(std::string_view id)
{
    const auto& commands = GetAdminCommands();
    for (const auto& command : commands)
        if (command.id == id) return &command;
    return nullptr;
}
}
