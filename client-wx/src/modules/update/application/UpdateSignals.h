#pragma once

namespace lila::modules::update
{
inline constexpr wchar_t LauncherCoordinationMutexName[] =
    L"Local\\LeMondeDeLilaWX.Launcher";
inline constexpr wchar_t SecondaryLaunchersSignalName[] =
    L"Local\\LeMondeDeLilaWX.SecondaryLaunchers";
inline constexpr wchar_t UpdateCheckSignalName[] =
    L"Local\\LeMondeDeLilaWX.UpdateCheck";

[[nodiscard]] bool IsForcedUpdateRequested();
[[nodiscard]] bool IsLauncherActive();
void* CreateHealthySignal();
void CloseSignal(void* signal) noexcept;
}
