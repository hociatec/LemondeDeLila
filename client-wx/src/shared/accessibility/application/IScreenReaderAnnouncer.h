#pragma once

#include <memory>
#include <string_view>

namespace lila::shared::accessibility
{
class IScreenReaderAnnouncer
{
public:
    virtual ~IScreenReaderAnnouncer() = default;
    [[nodiscard]] virtual bool Speak(std::wstring_view message) const noexcept = 0;
    [[nodiscard]] virtual bool SpeakAndWait(std::wstring_view message) const noexcept = 0;
};

[[nodiscard]] std::unique_ptr<IScreenReaderAnnouncer> CreateScreenReaderAnnouncer();
}
