#include "shared/accessibility/infrastructure/NvdaScreenReaderAnnouncer.h"

#ifdef __WXMSW__
#include <array>
#include <cstring>
#include <filesystem>
#include <string>
#include <type_traits>
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

template<typename Function>
Function ToFunctionPointer(FARPROC function) noexcept
{
    static_assert(std::is_trivially_copyable_v<Function>);
    static_assert(sizeof(Function) == sizeof(function));
    Function converted{};
    std::memcpy(&converted, &function, sizeof(converted));
    return converted;
}

std::wstring EscapeSsml(std::wstring_view message)
{
    std::wstring escaped;
    escaped.reserve(message.size() + 15);
    for (const wchar_t character : message)
    {
        switch (character)
        {
        case L'&': escaped += L"&amp;"; break;
        case L'<': escaped += L"&lt;"; break;
        case L'>': escaped += L"&gt;"; break;
        case L'\"': escaped += L"&quot;"; break;
        case L'\'': escaped += L"&apos;"; break;
        default: escaped += character; break;
        }
    }
    return L"<speak>" + escaped + L"</speak>";
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
        const auto speakSsml = FindExport(module, {
            "nvdaControllerClient_speakSsml", "nvdaController_speakSsml"});
        if (test != nullptr && speak != nullptr && speakSsml != nullptr)
        {
            module_ = module;
            testIfRunning_ = ToFunctionPointer<TestIfRunning>(test);
            speakText_ = ToFunctionPointer<SpeakText>(speak);
            speakSsml_ = ToFunctionPointer<SpeakSsml>(speakSsml);
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

bool NvdaScreenReaderAnnouncer::Speak(std::wstring_view message) const noexcept
{
#ifdef __WXMSW__
    if (message.empty() || testIfRunning_ == nullptr || speakText_ == nullptr)
        return false;
    try
    {
        if (testIfRunning_() != 0) return false;
        const std::wstring terminated(message);
        return speakText_(terminated.c_str()) == 0;
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

bool NvdaScreenReaderAnnouncer::SpeakAndWait(std::wstring_view message) const noexcept
{
#ifdef __WXMSW__
    if (message.empty() || testIfRunning_ == nullptr || speakSsml_ == nullptr)
        return false;
    try
    {
        if (testIfRunning_() != 0) return false;
        const std::wstring ssml = EscapeSsml(message);
        return speakSsml_(ssml.c_str(), -1, 0, false) == 0;
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

std::unique_ptr<IScreenReaderAnnouncer> CreateScreenReaderAnnouncer()
{
    return std::make_unique<NvdaScreenReaderAnnouncer>();
}

}
