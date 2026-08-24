#pragma once

#include <stop_token>
#include <string>
#include <string_view>
#include <vector>

#include "modules/vault/domain/VaultSnapshot.h"

namespace lila::modules::vault::application
{
class IVaultGateway
{
public:
    virtual ~IVaultGateway() = default;
    [[nodiscard]] virtual std::vector<domain::VaultSnapshot> List(std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual std::string Save(int roomId, std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual int Restore(std::string_view snapshotId, std::stop_token stopToken) const = 0;
    virtual void Delete(std::string_view snapshotId, std::stop_token stopToken) const = 0;
    virtual void Abandon(int roomId, std::stop_token stopToken) const = 0;
};
}
