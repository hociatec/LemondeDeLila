#pragma once

namespace lila::modules::social::domain
{
struct SocialRelationshipState final
{
    bool isFriend = false;
    bool isBlocked = false;
    bool blockedByTarget = false;
    bool outgoingRequest = false;
    bool incomingRequest = false;
};
}
