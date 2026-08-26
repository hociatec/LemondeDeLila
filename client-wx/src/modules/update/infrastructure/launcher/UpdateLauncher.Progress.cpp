#ifndef _WIN32_IE
#define _WIN32_IE 0x0700
#endif

#include <algorithm>
#include <objbase.h>
#include <shlobj.h>

#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
namespace
{
IProgressDialog* NativeDialog(void* dialog)
{
    return static_cast<IProgressDialog*>(dialog);
}
}

UpdateProgressDialog::~UpdateProgressDialog()
{
    Close();
}

void UpdateProgressDialog::Show(const std::string& version) noexcept
{
    if (dialog_) return;
    const HRESULT initialization = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    comInitialized_ = SUCCEEDED(initialization);
    if (FAILED(initialization) && initialization != RPC_E_CHANGED_MODE) return;

    IProgressDialog* dialog = nullptr;
    const HRESULT created = CoCreateInstance(CLSID_ProgressDialog, nullptr,
        CLSCTX_INPROC_SERVER, IID_IProgressDialog, reinterpret_cast<void**>(&dialog));
    if (FAILED(created) || !dialog) {
        if (comInitialized_) CoUninitialize();
        comInitialized_ = false;
        return;
    }

    dialog_ = dialog;
    dialog->SetTitle(L"Le Monde de Lila - Mise à jour");
    dialog->StartProgressDialog(nullptr, nullptr,
        PROGDLG_AUTOTIME | PROGDLG_NOMINIMIZE | PROGDLG_NOCANCEL, nullptr);
    const std::wstring versionLine = L"Installation de la version " + Widen(version);
    dialog->SetLine(1, versionLine.c_str(), FALSE, nullptr);
    dialog->Timer(PDTIMER_RESET, nullptr);
    SetStage(L"Préparation de la mise à jour…", 1);
}

void UpdateProgressDialog::SetStage(
    const std::wstring& stage,
    std::uint64_t percent) noexcept
{
    if (!dialog_) return;
    auto* dialog = NativeDialog(dialog_);
    dialog->SetLine(2, stage.c_str(), FALSE, nullptr);
    dialog->SetProgress64(std::min<std::uint64_t>(percent, 100), 100);
}

void UpdateProgressDialog::SetDownloadProgress(
    std::uint64_t completed,
    std::uint64_t total) noexcept
{
    if (!dialog_ || total == 0) return;
    const auto bounded = std::min(completed, total);
    const int downloadPercent = static_cast<int>((bounded * 100) / total);
    if (downloadPercent == lastDownloadPercent_) return;
    lastDownloadPercent_ = downloadPercent;
    const std::wstring label = L"Téléchargement… " +
        std::to_wstring(downloadPercent) + L" %";
    SetStage(label, 5 + static_cast<std::uint64_t>(downloadPercent) * 75 / 100);
}

void UpdateProgressDialog::Close() noexcept
{
    if (dialog_) {
        auto* dialog = NativeDialog(dialog_);
        dialog->StopProgressDialog();
        dialog->Release();
        dialog_ = nullptr;
    }
    if (comInitialized_) {
        CoUninitialize();
        comInitialized_ = false;
    }
}
}
