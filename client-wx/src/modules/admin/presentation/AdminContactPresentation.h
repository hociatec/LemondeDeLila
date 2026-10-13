#pragma once
#include <nlohmann/json.hpp>
#include <string>

namespace lila::modules::admin::presentation
{
inline nlohmann::json FlattenAdminContacts(const nlohmann::json& result)
{
    auto items = nlohmann::json::array();
    if (result.is_object() && result.contains("sections") && result["sections"].is_array())
        for (const auto& section : result["sections"])
        {
            if (!section.is_object() || !section.contains("items") || !section["items"].is_array()) continue;
            for (auto item : section["items"])
            {
                if (!item.is_object() || !item.contains("contactId")) continue;
                item["name"] = section.value("title", std::string{}) + " - " +
                    item.value("fromUsername", std::string("Utilisateur")) + " - " +
                    item.value("latestCreatedAt", std::string{});
                items.push_back(std::move(item));
            }
        }
    return {{"items", items}, {"total", items.size()}};
}
}
