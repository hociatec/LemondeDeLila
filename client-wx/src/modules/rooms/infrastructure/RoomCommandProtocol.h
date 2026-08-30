#pragma once

#include <stdexcept>
#include <string_view>

#include "modules/rooms/domain/Room.h"
#include "modules/rooms/infrastructure/RoomProtocol.h"

namespace lila::modules::rooms::infrastructure::command_protocol
{
inline std::string_view Type(domain::RoomCommand command)
{
    switch (command)
    {
    case domain::RoomCommand::Start: return protocol::Start;
    case domain::RoomCommand::Reset: return protocol::Reset;
    case domain::RoomCommand::AddBot: return protocol::AddBot;
    case domain::RoomCommand::RemoveBot: return protocol::RemoveBot;
    case domain::RoomCommand::TogglePrivacy: return protocol::TogglePrivacy;
    case domain::RoomCommand::SetRole: return protocol::SetRole;
    case domain::RoomCommand::Info: return protocol::Info;
    case domain::RoomCommand::SendChat: return protocol::SendChat;
    case domain::RoomCommand::Ping: return protocol::Ping;
    case domain::RoomCommand::Kick: return protocol::Kick;
    case domain::RoomCommand::Ban: return protocol::Ban;
    case domain::RoomCommand::SetAmbience: return protocol::SetAmbience;
    case domain::RoomCommand::SetOwner: return protocol::SetOwner;
    }
    throw std::invalid_argument("Commande de table inconnue.");
}

inline bool NeedsAcknowledgement(domain::RoomCommand command)
{
    return command == domain::RoomCommand::Start ||
        command == domain::RoomCommand::Reset ||
        command == domain::RoomCommand::AddBot ||
        command == domain::RoomCommand::RemoveBot ||
        command == domain::RoomCommand::TogglePrivacy ||
        command == domain::RoomCommand::Kick ||
        command == domain::RoomCommand::Ban ||
        command == domain::RoomCommand::SetAmbience ||
        command == domain::RoomCommand::SetOwner;
}

}
