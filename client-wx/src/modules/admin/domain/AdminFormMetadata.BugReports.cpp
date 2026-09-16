#include "modules/admin/domain/AdminFormMetadata.BugReports.h"

#include "modules/admin/domain/AdminFormMetadata.h"

namespace lila::modules::admin::domain
{
void ApplyBugReportFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName,
    AdminFieldMetadata& metadata)
{
    if (!commandId.starts_with("bugs.")) return;
    if (fieldName == "subject")
    {
        metadata.label = L"Sujet";
    }
    else if (fieldName == "content")
    {
        metadata.label = L"Contenu";
    }
    else if (fieldName == "status" && commandId == "bugs.list")
    {
        metadata.choices = {"all", "pending", "in_progress", "to_test", "done", "refused"};
        metadata.choiceLabels = {L"Tous", L"En attente", L"En cours",
            L"À tester", L"Terminés", L"Refusés"};
    }
    else if (fieldName == "status")
    {
        metadata.choices = {"pending", "in_progress", "to_test", "done", "refused"};
        metadata.choiceLabels = {
            L"En attente", L"En cours", L"À tester", L"Terminé", L"Refusé"};
    }
}
}
