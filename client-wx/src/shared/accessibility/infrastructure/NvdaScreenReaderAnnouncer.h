#pragma once

#include <type_traits>

#include "shared/accessibility/application/IScreenReaderAnnouncer.h"
#include "shared/accessibility/infrastructure/ScreenReaderCallGate.h"

#ifdef __WXMSW__
#include <windows.h>
#endif

namespace lila::shared::accessibility
{
class NvdaScreenReaderAnnouncer final : public IScreenReaderAnnouncer
{
public:
    NvdaScreenReaderAnnouncer();
    ~NvdaScreenReaderAnnouncer();

    NvdaScreenReaderAnnouncer(const NvdaScreenReaderAnnouncer&) = delete;
    NvdaScreenReaderAnnouncer& operator=(const NvdaScreenReaderAnnouncer&) = delete;

    [[nodiscard]] bool Speak(std::wstring_view message) const noexcept override;
    [[nodiscard]] bool SpeakAndWait(std::wstring_view message) const noexcept override;

private:
#ifdef __WXMSW__
    using TestIfRunning = long(__stdcall*)();
    using SpeakText = long(__stdcall*)(const wchar_t*);
    using SpeakSsml = long(__stdcall*)(const wchar_t*, int, int, unsigned char);
    using CancelSpeech = long(__stdcall*)();

    std::shared_ptr<std::remove_pointer_t<HMODULE>> module_;
    ScreenReaderCallGate calls_;
    TestIfRunning testIfRunning_ = nullptr;
    SpeakText speakText_ = nullptr;
    SpeakSsml speakSsml_ = nullptr;
    CancelSpeech cancelSpeech_ = nullptr;
#endif
};
}
