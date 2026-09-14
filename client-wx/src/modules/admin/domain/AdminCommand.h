#pragma once

#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace lila::modules::admin::domain
{
enum class AdminSection
{
    Dashboard,
    Users,
    Chat,
    Contacts,
    BugReports,
    Rooms,
    Games,
    Bots,
    MnemoQuiz,
    Roles,
    Settings,
    Sounds,
    Observability,
    Maintenance,
};

enum class AdminTransport
{
    ApiWebSocket,
    NotificationWebSocket,
    HttpJson,
    HttpMultipart,
    LocalAction,
};

struct AdminCommand final
{
    AdminCommand(
        std::string commandId,
        AdminSection commandSection,
        std::wstring commandLabel,
        std::wstring commandDescription,
        AdminTransport commandTransport,
        std::string commandOperation,
        std::string responseType = {},
        std::string defaultPayload = "{}",
        bool isDangerous = false,
        bool requiresMaintenanceToken = false)
        : id(std::move(commandId)), section(commandSection),
          label(std::move(commandLabel)), description(std::move(commandDescription)),
          transport(commandTransport), operation(std::move(commandOperation)),
          expectedResponseType(std::move(responseType)),
          payloadTemplate(std::move(defaultPayload)), dangerous(isDangerous),
          maintenanceToken(requiresMaintenanceToken)
    {
    }

    std::string id;
    AdminSection section = AdminSection::Dashboard;
    std::wstring label;
    std::wstring description;
    AdminTransport transport = AdminTransport::ApiWebSocket;
    std::string operation;
    std::string expectedResponseType;
    std::string payloadTemplate = "{}";
    bool dangerous = false;
    bool maintenanceToken = false;
};

struct AdminSectionDescriptor final
{
    AdminSection id;
    std::wstring_view label;
    std::wstring_view description;
};

[[nodiscard]] const std::vector<AdminCommand>& GetAdminCommands();
[[nodiscard]] const std::vector<AdminSectionDescriptor>& GetAdminSections();
[[nodiscard]] std::vector<const AdminCommand*> CommandsForSection(AdminSection section);
}
