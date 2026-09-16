#include "modules/admin/presentation/AdminBugReportFormatter.h"

#include <nlohmann/json.hpp>
#include <wx/datetime.h>

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
wxString Text(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_string()
        ? lila::shared::text::FromUtf8(found->get<std::string>()) : wxString{};
}

wxString CommentDate(const nlohmann::json& comment)
{
    const auto raw = Text(comment, "createdAt");
    wxDateTime date;
    if (raw.length() < 19 || !date.ParseISOCombined(raw.Left(19)))
        return raw.empty() ? wxString(L"Non renseignée") : raw;
    if (raw.Last() == 'Z') date.MakeFromUTC();
    return date.Format(wxString(L"%d/%m/%Y à %H:%M"));
}
}

wxString FormatAdminBugReport(const nlohmann::json& payload)
{
    const auto report = payload.find("report");
    if (report == payload.end() || !report->is_object())
        return wxString(L"Rapport indisponible.");
    auto result = wxString(L"Sujet : ") + Text(*report, "subject") +
        L"\n\nContenu :\n" + Text(*report, "content") + L"\n\nCommentaires :\n";
    const auto comments = payload.find("comments");
    if (comments == payload.end() || !comments->is_array() || comments->empty())
        return result + L"Aucun commentaire.";
    for (const auto& comment : *comments)
    {
        result += wxString(L"\nPseudo : ") + Text(comment, "createdByUsername") +
            L"\n\nDate : " + CommentDate(comment) +
            L"\n\nContenu :\n" + Text(comment, "content") + L"\n";
    }
    return result;
}
}
