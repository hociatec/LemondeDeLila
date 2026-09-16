#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <array>
#include <wx/panel.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/admin/presentation/AdminResultFormatter.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
namespace
{
const nlohmann::json* FindList(const nlohmann::json& result)
{
    if (result.is_array()) return &result;
    if (!result.is_object()) return nullptr;
    constexpr std::string_view keys[]{
        "items", "users", "rooms", "messages", "games", "categories",
        "questions", "definitions", "roles", "events", "sounds", "sections", "names", "reports"};
    for (const auto key : keys)
    {
        const auto found = result.find(key);
        if (found != result.end() && found->is_array()) return &*found;
    }
    return nullptr;
}

nlohmann::json FlattenSoundCatalog(const nlohmann::json& result)
{
    nlohmann::json sounds = nlohmann::json::array();
    if (!result.is_object() || !result.contains("categories") ||
        !result["categories"].is_array()) return nlohmann::json{{"sounds", sounds}};
    for (const auto& category : result["categories"])
        for (const auto& screen : category.value("screens", nlohmann::json::array()))
            for (auto sound : screen.value("sounds", nlohmann::json::array()))
            {
                const auto categoryName = category.value("name", std::string{});
                const auto screenName = screen.value("name", std::string{});
                const auto eventName = sound.value("event", sound.value("soundId", std::string{}));
                sound["name"] = categoryName + " — " + screenName + " — " + eventName;
                sounds.push_back(std::move(sound));
            }
    return nlohmann::json{{"sounds", std::move(sounds)}};
}
}

void AdminFrame::ShowResult(
    const domain::AdminCommand& command,
    const nlohmann::json& result)
{
    const auto displayResult = command.id == "sounds.catalog"
        ? FlattenSoundCatalog(result) : result;
    auto presentation = BuildAdminResultPresentation(displayResult);
    if (command.id == "bugs.get")
    {
        resultSummaryLabel_->SetLabel(wxString(L"Rapport consulté"));
        resultSummaryLabel_->Show();
        resultText_->SetValue(lila::shared::text::FromUtf8(presentation.details));
        resultText_->SetInsertionPoint(0);
        Layout();
        FocusResultDetails();
        return;
    }
    if (command.id == "bugs.list" && result.is_object())
    {
        const auto reportItems = result.find("items");
        if (reportItems != result.end() && reportItems->is_array())
            presentation = BuildAdminResultPresentation(
                nlohmann::json{{"reports", *reportItems}});
        const auto counts = result.value("statusCounts", nlohmann::json::object());
        const std::array<std::pair<std::string_view, std::wstring_view>, 5> statuses{{
            {"pending", L"En attente"}, {"in_progress", L"En cours"},
            {"to_test", L"À corriger"}, {"done", L"Terminés"}, {"refused", L"Refusés"},
        }};
        std::vector<lila::shared::ui::controls::VerticalMenuItem> statusItems;
        statusItems.reserve(statuses.size() + 1);
        statusItems.push_back({"new", wxString(L"Nouveau rapport")});
        for (std::size_t index = 0; index < statuses.size(); ++index)
        {
            const auto count = counts.value(std::string(statuses[index].first), 0);
            statusItems.push_back({std::to_string(index), wxString(statuses[index].second) +
                wxString::Format(L" (%d)", count)});
        }
        const auto selected = reportStatusMenu_->GetSelectedIndex();
        reportStatusMenu_->SetItems(statusItems);
        reportStatusMenu_->SetSelectedIndexSilently(
            std::min(selected, statusItems.size() - 1));
        if (loadingReportCountsOnly_)
        {
            loadingReportCountsOnly_ = false;
            resultItems_.clear();
            resultDetails_.clear();
            selectedResultIndex_.reset();
            resultsMenu_->Hide();
            reportActionsPanel_->Hide();
            paginationPanel_->Hide();
            resultText_->SetValue(wxString{});
            Layout();
            reportStatusMenu_->GetSelectedControl()->SetFocus();
            return;
        }
    }
    resultSummaryLabel_->SetLabel(
        wxString(command.label) + wxString(L" — ") +
        lila::shared::text::FromUtf8(presentation.summary));
    resultDetails_.clear();
    resultItems_.clear();
    selectedResultIndex_.reset();
    currentResultItemKind_ = domain::GetAdminAreas()[selectedSection_].itemKind;
    if (command.id == "bugs.comments") currentResultItemKind_ = domain::AdminItemKind::None;
    else if (command.id == "mnemo.categories")
        currentResultItemKind_ = domain::AdminItemKind::MnemoCategory;
    else if (command.id == "mnemo.questions")
        currentResultItemKind_ = domain::AdminItemKind::MnemoQuestion;
    reportActionsPanel_->Hide();
    if (const auto* list = FindList(displayResult))
        for (const auto& item : *list) resultItems_.push_back(item);

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
        (currentResultItemKind_ == domain::AdminItemKind::None
            ? ". Utilisez les flèches haut et bas pour parcourir la liste."
            : ". Entrée ouvre les actions ; les flèches haut et bas parcourent la liste.")));
    UpdateBugReportActions();
}
}
