#include "shared/accessibility/infrastructure/NvdaScreenReaderAnnouncer.h"

#ifdef __WXMSW__
#include <array>
#include <filesystem>
#include <string>
#endif

namespace lila::shared::accessibility
{
#ifdef __WXMSW__
namespace
{
std::filesystem::path ExecutableDirectory()
{
    std::wstring path(32768, L'\0');
    const auto length = GetModuleFileNameW(
        nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (length == 0 || length >= path.size()) return {};
    path.resize(length);
    return std::filesystem::path(path).parent_path();
}

FARPROC FindExport(HMODULE module, const std::array<const char*, 2>& names)
{
    for (const auto* name : names)
        if (auto* found = GetProcAddress(module, name)) return found;
    return nullptr;
}
}
#endif

NvdaScreenReaderAnnouncer::NvdaScreenReaderAnnouncer()
{
#ifdef __WXMSW__
    const auto root = ExecutableDirectory();
    const std::array candidates{
        root / "libs" / "x64" / "nvdaControllerClient64.dll",
        root / "libs" / "x64" / "nvdaControllerClient.dll",
        root / "nvdaControllerClient64.dll",
        root / "nvdaControllerClient.dll",
    };

    for (const auto& path : candidates)
    {
        auto* module = LoadLibraryW(path.c_str());
        if (module == nullptr) continue;
        const auto test = FindExport(module, {
            "nvdaControllerClient_testIfRunning", "nvdaController_testIfRunning"});
        const auto speak = FindExport(module, {
            "nvdaControllerClient_speakText", "nvdaController_speakText"});
        if (test != nullptr && speak != nullptr)
        {
            module_ = module;
            testIfRunning_ = reinterpret_cast<TestIfRunning>(test);
            speakText_ = reinterpret_cast<SpeakText>(speak);
            return;
        }
        FreeLibrary(module);
    }
#endif
}

NvdaScreenReaderAnnouncer::~NvdaScreenReaderAnnouncer()
{
#ifdef __WXMSW__
    if (module_ != nullptr) FreeLibrary(module_);
#endif
}

bool NvdaScreenReaderAnnouncer::Speak(const wxString& message) const noexcept
{
#ifdef __WXMSW__
    if (message.empty() || testIfRunning_ == nullptr || speakText_ == nullptr)
        return false;
    try
    {
        if (testIfRunning_() != 0) return false;
        return speakText_(message.wc_str()) == 0;
    }
    catch (...)
    {
        return false;
    }
#else
    static_cast<void>(message);
    return false;
#endif
}
}
