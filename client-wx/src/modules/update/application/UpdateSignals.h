#pragma once

namespace lila::modules::update
{
inline constexpr wchar_t LauncherCoordinationMutexName[] =
    L"Local\\LeMondeDeLilaWX.Launcher";
inline constexpr wchar_t SecondaryLaunchersSignalName[] =
    L"Local\\LeMondeDeLilaWX.SecondaryLaunchers";

[[nodiscard]] bool IsForcedUpdateRequested();
[[nodiscard]] bool IsLauncherActive();
void* CreateHealthySignal();
void CloseSignal(void* signal) noexcept;
}
