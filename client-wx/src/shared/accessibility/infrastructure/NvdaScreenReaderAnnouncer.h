#pragma once

#include <wx/string.h>

#ifdef __WXMSW__
#include <windows.h>
#endif

namespace lila::shared::accessibility
{
class NvdaScreenReaderAnnouncer final
{
public:
    NvdaScreenReaderAnnouncer();
    ~NvdaScreenReaderAnnouncer();

    NvdaScreenReaderAnnouncer(const NvdaScreenReaderAnnouncer&) = delete;
    NvdaScreenReaderAnnouncer& operator=(const NvdaScreenReaderAnnouncer&) = delete;

    [[nodiscard]] bool Speak(const wxString& message) const noexcept;

private:
#ifdef __WXMSW__
    using TestIfRunning = int(__cdecl*)();
    using SpeakText = int(__cdecl*)(const wchar_t*);

    HMODULE module_ = nullptr;
    TestIfRunning testIfRunning_ = nullptr;
    SpeakText speakText_ = nullptr;
#endif
};
}
