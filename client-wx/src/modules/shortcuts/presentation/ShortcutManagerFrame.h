#pragma once
#include <functional>
#include "modules/shortcuts/domain/Shortcut.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/accessibility/presentation/FocusPlanView.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"
namespace lila::modules::shortcuts::application { class ShortcutStore; }
namespace lila::modules::catalog::application { class CatalogService; }
class wxListBox;
class wxStaticText;
class wxButton;
namespace lila::modules::shortcuts::presentation
{
class ShortcutManagerFrame final : public lila::shared::accessibility::NonFocusablePanel,
    public lila::shared::accessibility::FocusPlanView
{
public:
    ShortcutManagerFrame(wxWindow* parent, application::ShortcutStore& store,
        lila::modules::catalog::application::CatalogService& catalog, int userId, bool admin, bool beta,
        std::function<void()> onClose);
    void Reload();
    void SetAccess(bool admin, bool beta) { admin_ = admin; beta_ = beta; }
    void AddForTarget(std::string target);
    lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;
private:
    void BuildLayout();
    void Edit(bool adding);
    void Toggle();
    void Remove();
    void Reset();
    void Save(domain::ShortcutSnapshot value);
    void Render();
    void Busy(bool value);
    void Status(const wxString& text);
    application::ShortcutStore& store_;
    lila::modules::catalog::application::CatalogService& catalog_;
    int userId_;
    bool admin_, beta_, busy_ = false;
    std::function<void()> onClose_;
    domain::ShortcutSnapshot snapshot_;
    std::vector<domain::ShortcutTarget> targets_;
    std::string pendingTarget_;
    wxListBox* list_ = nullptr;
    wxStaticText* status_ = nullptr;
    wxButton *add_ = nullptr, *edit_ = nullptr, *toggle_ = nullptr, *remove_ = nullptr,
        *reset_ = nullptr, *refresh_ = nullptr, *back_ = nullptr;
    lila::shared::concurrency::AsyncRequestSlot request_;
};
}
