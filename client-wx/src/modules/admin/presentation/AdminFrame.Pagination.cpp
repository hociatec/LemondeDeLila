#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>
#include <wx/stattext.h>

#include "modules/admin/domain/AdminPagination.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::ResetPagination(
    const domain::AdminCommand& command,
    const nlohmann::json& payload)
{
    const auto spec = domain::GetAdminPaginationSpec(command.id);
    if (spec.mode == domain::AdminPaginationMode::None)
    {
        paginationCommand_ = nullptr;
        paginationPayload_ = nlohmann::json::object();
        return;
    }
    paginationCommand_ = &command;
    paginationPayload_ = payload;
}

void AdminFrame::UpdatePagination(
    const nlohmann::json& result,
    std::size_t displayedCount)
{
    if (paginationCommand_ == nullptr)
    {
        paginationPanel_->Hide();
        return;
    }
    const auto spec = domain::GetAdminPaginationSpec(paginationCommand_->id);
    const int pageSize = std::clamp(
        paginationPayload_.value("limit", spec.defaultPageSize),
        1,
        spec.maximumPageSize);
    int page = 1;
    if (spec.mode == domain::AdminPaginationMode::PageNumber)
        page = std::max(1, paginationPayload_.value("page", 1));
    else if (spec.mode == domain::AdminPaginationMode::Offset)
        page = std::max(0, paginationPayload_.value("offset", 0)) / pageSize + 1;

    pageSizeChoices_ = domain::AdminPageSizeChoices(spec, pageSize);
    pageSizeChoice_->Clear();
    int selected = wxNOT_FOUND;
    for (std::size_t index = 0; index < pageSizeChoices_.size(); ++index)
    {
        const auto value = pageSizeChoices_[index];
        pageSizeChoice_->Append(wxString::Format(
            value == 1 ? L"%d élément par page" : L"%d éléments par page", value));
        if (value == pageSize) selected = static_cast<int>(index);
    }
    pageSizeChoice_->SetSelection(selected == wxNOT_FOUND ? 0 : selected);

    const bool navigable = spec.mode == domain::AdminPaginationMode::PageNumber ||
        spec.mode == domain::AdminPaginationMode::Offset;
    previousPageButton_->Show(navigable);
    nextPageButton_->Show(navigable);
    previousPageButton_->Enable(navigable && page > 1 && !loading_);
    bool hasNext = navigable && displayedCount >= static_cast<std::size_t>(pageSize);
    if (result.is_object())
    {
        const auto total = result.find("total");
        if (total != result.end() && total->is_number_integer())
            hasNext = static_cast<long long>(page) * pageSize < total->get<long long>();
    }
    nextPageButton_->Enable(hasNext && !loading_);
    pageSizeChoice_->Enable(!loading_);

    const auto count = static_cast<unsigned long long>(displayedCount);
    if (navigable)
        paginationLabel_->SetLabel(wxString::Format(
            count == 1 ? L"Pagination — page %d — %llu élément affiché" :
                         L"Pagination — page %d — %llu éléments affichés",
            page, count));
    else
        paginationLabel_->SetLabel(wxString::Format(
            count == 1 ? L"Affichage — %llu élément affiché" :
                         L"Affichage — %llu éléments affichés",
            count));
    paginationPanel_->Show();
}

void AdminFrame::ChangePage(int direction)
{
    if (loading_ || paginationCommand_ == nullptr || direction == 0) return;
    const auto spec = domain::GetAdminPaginationSpec(paginationCommand_->id);
    const int pageSize = std::clamp(
        paginationPayload_.value("limit", spec.defaultPageSize), 1, spec.maximumPageSize);
    if (spec.mode == domain::AdminPaginationMode::PageNumber)
    {
        const int page = std::max(1, paginationPayload_.value("page", 1));
        paginationPayload_["page"] = std::max(1, page + direction);
    }
    else if (spec.mode == domain::AdminPaginationMode::Offset)
    {
        const int offset = std::max(0, paginationPayload_.value("offset", 0));
        paginationPayload_["offset"] = std::max(0, offset + direction * pageSize);
    }
    else return;
    ExecuteCommand(*paginationCommand_, paginationPayload_);
}

void AdminFrame::ChangePageSize()
{
    if (loading_ || paginationCommand_ == nullptr) return;
    const auto selected = pageSizeChoice_->GetSelection();
    if (selected == wxNOT_FOUND ||
        static_cast<std::size_t>(selected) >= pageSizeChoices_.size()) return;
    paginationPayload_["limit"] = pageSizeChoices_[static_cast<std::size_t>(selected)];
    const auto spec = domain::GetAdminPaginationSpec(paginationCommand_->id);
    if (spec.mode == domain::AdminPaginationMode::PageNumber) paginationPayload_["page"] = 1;
    if (spec.mode == domain::AdminPaginationMode::Offset) paginationPayload_["offset"] = 0;
    ExecuteCommand(*paginationCommand_, paginationPayload_);
}
}
