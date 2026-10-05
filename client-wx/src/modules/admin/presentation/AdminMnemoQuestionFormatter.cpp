#include "modules/admin/presentation/AdminMnemoQuestionFormatter.h"

#include <sstream>

#include <nlohmann/json.hpp>

namespace lila::modules::admin::presentation
{
namespace
{
std::string StatusLabel(const nlohmann::json& value)
{
    if (!value.is_string()) return "—";
    const auto status = value.get<std::string>();
    if (status == "validated") return "Validé";
    if (status == "pending") return "En attente";
    if (status == "to_edit") return "À modifier";
    if (status == "trash") return "Corbeille";
    return status;
}
}

std::optional<std::string> FormatAdminMnemoQuestion(const nlohmann::json& value)
{
    if (!value.is_object() || !value.contains("question") ||
        !value["question"].is_string() || !value.contains("answers") ||
        !value["answers"].is_array() || !value.contains("correctIndex"))
        return std::nullopt;

    std::ostringstream output;
    output << "Question : " << value.value("question", std::string{}) << '\n';
    output << "Catégorie : " << value.value("categoryId", std::string{}) << '\n';
    output << "Statut : " << StatusLabel(value.value("status", nlohmann::json{})) << '\n';
    const auto correctIndex = value.value("correctIndex", -1);
    const auto& answers = value["answers"];
    for (std::size_t index = 0; index < answers.size(); ++index)
    {
        output << (static_cast<int>(index) == correctIndex
                ? "Bonne réponse : "
                : "Mauvaise réponse : ");
        output << (answers[index].is_string() ? answers[index].get<std::string>()
                                              : answers[index].dump()) << '\n';
    }
    output << "Identifiant : " << value.value("id", std::string{}) << '\n';
    return output.str();
}
}
