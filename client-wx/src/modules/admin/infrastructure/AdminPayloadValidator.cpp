#include "modules/admin/infrastructure/AdminPayloadValidator.h"

#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace lila::modules::admin::infrastructure
{
namespace
{
constexpr std::size_t MaximumDepth = 24;
constexpr std::size_t MaximumNodes = 100'000;
constexpr std::size_t MaximumKeyLength = 256;
constexpr std::size_t MaximumStringLength = 16U * 1024U * 1024U;

void ValidateNode(nlohmann::json& node, std::size_t depth, std::size_t& count)
{
    if (depth > MaximumDepth || ++count > MaximumNodes)
        throw std::runtime_error("Réponse administrateur trop complexe.");
    if (node.is_string())
    {
        auto& value = node.get_ref<std::string&>();
        if (value.size() > MaximumStringLength)
            throw std::runtime_error("Texte de réponse administrateur trop volumineux.");
        return;
    }
    if (node.is_array())
    {
        for (auto& child : node) ValidateNode(child, depth + 1, count);
        return;
    }
    if (!node.is_object()) return;
    for (auto& item : node.items())
    {
        if (item.key().size() > MaximumKeyLength)
            throw std::runtime_error("Champ de réponse administrateur invalide.");
        if (item.key() == "status" && item.value().is_string() &&
            item.value().get_ref<const std::string&>() == "rejected")
            item.value() = "refused";
        ValidateNode(item.value(), depth + 1, count);
    }
}
}

nlohmann::json ValidateAndNormalizeAdminPayload(const nlohmann::json& payload)
{
    if (!payload.is_object() && !payload.is_array())
        throw std::runtime_error("La réponse administrateur doit être un objet ou une liste JSON.");
    auto normalized = payload;
    std::size_t count = 0;
    ValidateNode(normalized, 0, count);
    return normalized;
}
}
