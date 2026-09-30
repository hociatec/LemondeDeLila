#pragma once

namespace lila::modules::update
{
[[nodiscard]] bool IsForcedUpdateRequested();
[[nodiscard]] bool IsLauncherActive();
void* CreateHealthySignal();
void CloseSignal(void* signal) noexcept;
}
