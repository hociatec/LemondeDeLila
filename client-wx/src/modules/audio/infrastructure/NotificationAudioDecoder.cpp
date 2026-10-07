#include "modules/audio/application/NotificationAudioDecoder.h"
#include <nlohmann/json.hpp>
#include "generated/protocol/WsMessageTypes.generated.h"

namespace lila::modules::audio::application
{
namespace
{
constexpr std::string_view SoundsUpdatedEvent = "sounds.updated";
constexpr std::string_view BugReportCommentAddedEvent = "bugReports.comment.added";
}
NotificationAudioEvent NotificationAudioDecoder::Decode(const std::string& message, int selfId)
{
    using domain::SoundCue;
    const auto root = nlohmann::json::parse(message, nullptr, false);
    if (!root.is_object()) return {};
    const auto typeField = root.find("type");
    const auto payloadField = root.find("payload");
    if (typeField == root.end() || !typeField->is_string() ||
        payloadField == root.end() || !payloadField->is_object()) return {};
    const auto& payload = *payloadField;
    const auto type = typeField->get<std::string>();
    namespace ws = lila::shared::network::ws::types;
    if (type == ws::notify::Connected) return {std::nullopt, true};
    const auto text = [&payload](const char* key)
    {
        const auto value = payload.find(key);
        return value != payload.end() && (value->is_string() || value->is_number_integer())
            ? value->dump() : std::string{};
    };
    const auto fromSelf = [&payload, selfId](const char* key)
    {
        const auto value = payload.find(key);
        return selfId > 0 && value != payload.end() && value->is_number_integer() && *value == selfId;
    };
    NotificationAudioEvent result;
    std::string identity;
    if (type == SoundsUpdatedEvent || type == "sounds.tableAmbiences.updated")
    {
        // Distinct commits can share the same millisecond timestamp.
        return {std::nullopt, true};
    }
    else if (type == ws::messaging::MessageSent)
    {
        result.cue = SoundCue::PrivateMessageReceived;
        identity = text("messageId");
    }
    else if (type == ws::social::FriendRequested && !fromSelf("requesterId"))
    {
        result.cue = SoundCue::FriendInvitationReceived;
        identity = text("requestId");
        if (identity.empty()) identity = text("requesterId");
    }
    else if (type == ws::notify::inbox::Item && text("kind") == "\"admin_contact\"" &&
        !fromSelf("fromUserId"))
    {
        result.cue = SoundCue::AdminContactReceived;
        identity = text("id");
    }
    else if (type == BugReportCommentAddedEvent && !fromSelf("createdByUserId"))
    {
        result.cue = SoundCue::BugReportCommentReceived;
        identity = text("commentId");
    }
    else if (type == ws::clientUpdate::Available || type == ws::clientUpdate::Required ||
        type == ws::clientUpdate::Imminent)
    {
        result.cue = SoundCue::ClientUpdateWarning;
        identity = payload.dump();
    }
    else return {}; // Counts, snapshots, status updates and history stay silent.
    if (identity.empty()) return result.refreshAssets ? result : NotificationAudioEvent{};
    identity = type + ":" + identity;
    if (!seen_.insert(identity).second) return {};
    order_.push_back(identity);
    if (order_.size() > 512) { seen_.erase(order_.front()); order_.pop_front(); }
    return result;
}
}
