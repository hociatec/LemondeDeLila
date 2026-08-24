#include "modules/vault/application/VaultService.h"

#include "modules/vault/application/IVaultGateway.h"

namespace lila::modules::vault::application
{
VaultService::VaultService(IVaultGateway& gateway) noexcept : gateway_(gateway) {}

std::vector<domain::VaultSnapshot> VaultService::List(std::stop_token stopToken) const
{
    return gateway_.List(stopToken);
}

std::string VaultService::Save(int roomId, std::stop_token stopToken) const
{
    return gateway_.Save(roomId, stopToken);
}

int VaultService::Restore(std::string_view snapshotId, std::stop_token stopToken) const
{
    return gateway_.Restore(snapshotId, stopToken);
}

void VaultService::Delete(std::string_view snapshotId, std::stop_token stopToken) const
{
    gateway_.Delete(snapshotId, stopToken);
}

void VaultService::Abandon(int roomId, std::stop_token stopToken) const
{
    gateway_.Abandon(roomId, stopToken);
}
}
