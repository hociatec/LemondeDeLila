#pragma once

#include <stop_token>
#include <string>
#include <string_view>
#include <vector>

#include "modules/vault/domain/VaultSnapshot.h"

namespace lila::modules::vault::application
{
class IVaultGateway;

class VaultService final
{
public:
    explicit VaultService(IVaultGateway& gateway) noexcept;
    [[nodiscard]] std::vector<domain::VaultSnapshot> List(std::stop_token stopToken) const;
    [[nodiscard]] std::string Save(int roomId, std::stop_token stopToken) const;
    [[nodiscard]] int Restore(std::string_view snapshotId, std::stop_token stopToken) const;
    void Delete(std::string_view snapshotId, std::stop_token stopToken) const;
    void Abandon(int roomId, std::stop_token stopToken) const;

private:
    IVaultGateway& gateway_;
};
}
