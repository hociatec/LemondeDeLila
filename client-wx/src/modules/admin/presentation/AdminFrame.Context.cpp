#include "modules/admin/presentation/AdminFrame.h"

#include <array>

namespace lila::modules::admin::presentation
{
namespace
{
const nlohmann::json* FirstValue(
    const nlohmann::json& item,
    std::initializer_list<std::string_view> keys)
{
    for (const auto key : keys)
    {
        const auto value = item.find(key);
        if (value != item.end() && !value->is_null()) return &*value;
    }
    return nullptr;
}

void CopyAlias(
    nlohmann::json& payload,
    const nlohmann::json& item,
    std::string_view target,
    std::initializer_list<std::string_view> sources)
{
    if (!payload.contains(target)) return;
    if (const auto* value = FirstValue(item, sources)) payload[target] = *value;
}
}

void AdminFrame::ApplyContextToPayload(
    const domain::AdminCommand& command,
    nlohmann::json& payload) const
{
    (void)command;
    if (!contextItem_.is_object()) return;
    for (auto& item : payload.items())
    {
        const auto value = contextItem_.find(item.key());
        if (value != contextItem_.end() && !value->is_null()) item.value() = *value;
    }
    CopyAlias(payload, contextItem_, "id", {"id", "userId", "reportId", "categoryId"});
    CopyAlias(payload, contextItem_, "userId", {"userId", "createdByUserId", "id"});
    CopyAlias(payload, contextItem_, "toUserId", {"userId", "createdByUserId", "authorId", "id"});
    CopyAlias(payload, contextItem_, "messageId", {"messageId", "id"});
    CopyAlias(payload, contextItem_, "reportId", {"reportId", "id"});
    CopyAlias(payload, contextItem_, "contactId", {"contactId", "id"});
    CopyAlias(payload, contextItem_, "roomId", {"roomId", "id"});
    CopyAlias(payload, contextItem_, "gameType", {"gameType", "type", "id"});
    CopyAlias(payload, contextItem_, "categoryId", {"categoryId", "id"});
    CopyAlias(payload, contextItem_, "soundId", {"soundId", "event", "id"});
}

bool AdminFrame::ContextCommandMutates(const domain::AdminCommand& command) const
{
    if (command.transport == domain::AdminTransport::LocalAction ||
        command.operation.starts_with("GET ")) return false;
    constexpr std::array<std::string_view, 5> readOnly{
        "bugs.get", "bugs.comments", "rooms.join", "mnemo.categories", "mnemo.questions"};
    for (const auto id : readOnly)
        if (command.id == id) return false;
    return true;
}
}
