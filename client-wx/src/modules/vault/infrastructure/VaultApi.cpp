#include "modules/vault/infrastructure/VaultApi.h"

#include <nlohmann/json.hpp>

#include "modules/session/application/SessionStore.h"
#include "modules/vault/infrastructure/VaultPayloadCodec.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::vault::infrastructure
{
namespace
{
auto Request(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore,
    const char* eventName,
    nlohmann::json payload,
    std::stop_token stopToken)
{
    return lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client,
        sessionStore,
        lila::shared::errors::NoActiveVaultSession,
        eventName,
        std::move(payload),
        lila::shared::errors::VaultOperationFailed,
        stopToken);
}
}

VaultApi::VaultApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore) {}

std::vector<domain::VaultSnapshot> VaultApi::List(std::stop_token stopToken) const
{
    return codec::ReadSnapshots(Request(
        client_, sessionStore_, "vault.list", nlohmann::json::object(), stopToken).payload);
}

std::string VaultApi::Save(int roomId, std::stop_token stopToken) const
{
    return codec::ReadSavedId(Request(
        client_, sessionStore_, "vault.save", codec::BuildSaveRequest(roomId), stopToken).payload);
}

int VaultApi::Restore(std::string_view snapshotId, std::stop_token stopToken) const
{
    return codec::ReadRestoredRoomId(Request(
        client_, sessionStore_, "vault.restore", {{"id", std::string(snapshotId)}}, stopToken).payload);
}

void VaultApi::Delete(std::string_view snapshotId, std::stop_token stopToken) const
{
    codec::ValidateDelete(Request(
        client_, sessionStore_, "vault.delete", {{"id", std::string(snapshotId)}}, stopToken).payload);
}

void VaultApi::Abandon(int roomId, std::stop_token stopToken) const
{
    codec::ValidateAbandon(Request(
        client_, sessionStore_, "vault.abandon", codec::BuildAbandonRequest(roomId), stopToken).payload);
}
}
