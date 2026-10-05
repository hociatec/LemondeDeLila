#include "modules/admin/presentation/AdminBugReportListFormatter.h"

#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::modules::admin::presentation
{
namespace
{
std::string ReportStatusLabel(std::string_view status)
{
    static const std::pair<std::string_view, std::string_view> Statuses[]{
        {"pending", "En attente"}, {"in_progress", "En cours"},
        {"to_test", "À tester"}, {"done", "Terminé"}, {"refused", "Refusé"},
    };
    for (const auto& [raw, label] : Statuses)
        if (status == raw) return std::string(label);
    return std::string(status);
}
}

std::optional<std::string> FormatAdminBugReportListTitle(const nlohmann::json& report)
{
    const auto subject = report.find("subject");
    const auto status = report.find("status");
    if (!report.is_object() || subject == report.end() || !subject->is_string() ||
        status == report.end() || !status->is_string()) return std::nullopt;

    auto title = subject->get<std::string>() + " — " +
        ReportStatusLabel(status->get<std::string>());
    const auto author = report.find("createdByUsername");
    if (author != report.end() && author->is_string())
        title += " — " + author->get<std::string>();
    const auto commentsCount = report.find("commentsCount");
    if (commentsCount != report.end() && commentsCount->is_number_integer())
    {
        const auto count = commentsCount->dump();
        if (!count.starts_with('-'))
            title += " — " + count + (count == "1" ? " commentaire" : " commentaires");
    }
    return title;
}
}
