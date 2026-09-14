#pragma once

#include <algorithm>
#include <cctype>
#include <string>

#include "modules/catalog/domain/CatalogShelf.h"

namespace lila::modules::catalog::application
{
class CatalogVisibilityPolicy final
{
public:
    [[nodiscard]] static bool IsVisible(
        const domain::CatalogGame& game,
        bool betaEnabled,
        bool administrator)
    {
        if (administrator) return true;
        const auto status = NormalizedStatus(game.status);
        return status != "construction" && (status != "beta" || betaEnabled);
    }

    [[nodiscard]] static std::string DisplayName(
        const domain::CatalogGame& game,
        bool administrator)
    {
        if (!administrator) return game.name;
        const auto status = NormalizedStatus(game.status);
        const auto label = status == "finished" ? "terminé"
            : status == "beta" ? "bêta"
            : status == "construction" ? "construction"
            : status.empty() ? "statut inconnu"
            : status;
        return game.name + " (" + label + ")";
    }

private:
    [[nodiscard]] static std::string NormalizedStatus(std::string status)
    {
        std::transform(
            status.begin(), status.end(), status.begin(),
            [](unsigned char value)
            {
                return static_cast<char>(std::tolower(value));
            });
        return status;
    }
};
}
