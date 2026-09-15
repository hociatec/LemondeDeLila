#include "modules/admin/presentation/AdminFrame.h"

#include <wx/panel.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/admin/presentation/AdminResultFormatter.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::ShowResult(
    const domain::AdminCommand& command,
    const nlohmann::json& result)
{
    auto presentation = BuildAdminResultPresentation(result);
    if (command.id == "bugs.list" && result.is_object())
    {
        const auto reportItems = result.find("items");
        if (reportItems != result.end() && reportItems->is_array())
            presentation = BuildAdminResultPresentation(
                nlohmann::json{{"reports", *reportItems}});
    }
    resultSummaryLabel_->SetLabel(
        wxString(command.label) + wxString(L" — ") +
        lila::shared::text::FromUtf8(presentation.summary));
    resultDetails_.clear();
    resultItems_.clear();
    selectedResultIndex_.reset();
    reportActionsPanel_->Hide();

    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    items.reserve(presentation.entries.size());
    resultDetails_.reserve(presentation.entries.size());
    for (std::size_t index = 0; index < presentation.entries.size(); ++index)
    {
        items.push_back({
            std::to_string(index),
            lila::shared::text::FromUtf8(presentation.entries[index].label),
        });
        resultDetails_.push_back(presentation.entries[index].details);
    }

    if (command.id == "bugs.list" && result.is_object())
    {
        const auto found = result.find("items");
        if (found != result.end() && found->is_array())
            for (const auto& item : *found) resultItems_.push_back(item);
    }

    resultsMenu_->SetItems(items);
    resultsMenu_->Show(!items.empty());
    resultText_->SetValue(lila::shared::text::FromUtf8(presentation.details));
    if (!items.empty())
    {
        std::size_t selectedIndex = 0;
        if (reportIdToRestore_)
            for (std::size_t index = 0; index < resultItems_.size(); ++index)
                if (resultItems_[index].value("id", std::string{}) == *reportIdToRestore_)
                {
                    selectedIndex = index;
                    break;
                }
        resultsMenu_->SetSelectedIndexSilently(selectedIndex);
        ShowResultDetails(selectedIndex);
    }
    reportIdToRestore_.reset();
    UpdatePagination(result, presentation.entries.size());
    Layout();
}

void AdminFrame::ShowResultDetails(std::size_t index)
{
    if (index >= resultDetails_.size()) return;
    selectedResultIndex_ = index;
    resultText_->SetValue(lila::shared::text::FromUtf8(resultDetails_[index]));
    resultText_->SetInsertionPoint(0);
    SetStatus(lila::shared::text::FromUtf8(
        "Élément " + std::to_string(index + 1) + " sur " +
        std::to_string(resultDetails_.size()) +
        ". Entrée ou Tabulation pour lire le détail."));
    UpdateBugReportActions();
}
}
