#include "modules/shortcuts/presentation/ShortcutManagerFrame.h"
#include "modules/shortcuts/presentation/ShortcutEditorDialog.h"
#include "modules/shortcuts/application/ShortcutStore.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/app.h>
#include <wx/weakref.h>

namespace lila::modules::shortcuts::presentation
{
void ShortcutManagerFrame::AddForTarget(std::string target)
{
    pendingTarget_ = std::move(target);
    Reload();
}
void ShortcutManagerFrame::Edit(bool adding)
{
    if (busy_ || !snapshot_.synchronized) return;
    const auto index = list_->GetSelection();
    if (!adding && index < 0) return;
    domain::Shortcut initial;
    if (!adding) initial = snapshot_.items[static_cast<std::size_t>(index)];
    else if (!pendingTarget_.empty())
        for (const auto& target : targets_) if (target.id == pendingTarget_)
            initial = {target.id, target.label, {}, true};
    pendingTarget_.clear();
    auto others = snapshot_.items;
    if (!adding) others.erase(others.begin() + index);
    ShortcutEditorDialog editor(this, targets_, initial, others);
    if (editor.ShowModal() != wxID_OK) return;
    auto next = snapshot_;
    if (adding) next.items.push_back(editor.Result());
    else next.items[static_cast<std::size_t>(index)] = editor.Result();
    Save(std::move(next));
}
void ShortcutManagerFrame::Toggle()
{
    const auto index = list_->GetSelection();
    if (busy_ || index < 0 || !snapshot_.synchronized) return;
    auto next = snapshot_;
    next.items[static_cast<std::size_t>(index)].enabled = !next.items[static_cast<std::size_t>(index)].enabled;
    Save(std::move(next));
}
void ShortcutManagerFrame::Remove()
{
    const auto index = list_->GetSelection();
    if (busy_ || index < 0 || !snapshot_.synchronized) return;
    if (wxMessageBox(L"Supprimer ce raccourci ?", L"Mes raccourcis", wxYES_NO | wxNO_DEFAULT, this) != wxYES) return;
    auto next = snapshot_;
    next.items.erase(next.items.begin() + index);
    Save(std::move(next));
}
void ShortcutManagerFrame::Reset()
{
    if (busy_ || !snapshot_.synchronized) return;
    if (wxMessageBox(L"Supprimer tous vos raccourcis personnels ? Les commandes du logiciel seront conservées.",
        L"Réinitialiser", wxYES_NO | wxNO_DEFAULT | wxICON_WARNING, this) != wxYES) return;
    auto next = snapshot_; next.items.clear(); Save(std::move(next));
}
void ShortcutManagerFrame::Save(domain::ShortcutSnapshot value)
{
    Busy(true); Status(L"Enregistrement des raccourcis...");
    request_.Cancel();
    const auto token = request_.CurrentToken();
    auto* store = &store_;
    wxWeakRef<ShortcutManagerFrame> weak(this);
    auto task = lila::shared::concurrency::RunAsync<domain::ShortcutSnapshot>(
        [store, userId = userId_, value](std::stop_token stop) { return store->Save(userId, value, stop); },
        [weak, token](std::optional<lila::shared::errors::AppError> error, std::optional<domain::ShortcutSnapshot> result)
        {
            wxTheApp->CallAfter([weak, token, error, result]
            {
                if (!weak || !weak->request_.Complete(token)) return;
                weak->Busy(false);
                if (error || !result)
                {
                    weak->Status(error ? lila::shared::text::FromUtf8(error->UserMessage()) : wxString(L"Enregistrement impossible."));
                    return;
                }
                weak->snapshot_ = *result;
                weak->Render(); weak->Status(L"Raccourcis enregistrés sur votre compte.");
            });
        }, lila::shared::concurrency::BackgroundTaskPriority::Normal, "Enregistrement des raccourcis impossible.");
    if (!task->WasAccepted()) { Busy(false); Status(L"Service occupé. Réessayez."); return; }
    request_.Track(std::move(task));
}
}
