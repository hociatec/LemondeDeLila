#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <shellapi.h>

#include <filesystem>
#include <stdexcept>
#include <string>

#include "modules/update/infrastructure/launcher/UpdateLauncher.h"
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

using namespace lila::modules::update::launcher;

int lila::modules::update::RunUpdateLauncher()
{
    try {
        int argumentCount = 0;
        LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &argumentCount);
        if (arguments && argumentCount == 4 && std::wstring(arguments[1]) == L"--replace-launcher") {
            const DWORD parentId = static_cast<DWORD>(std::stoul(arguments[2]));
            const fs::path target(arguments[3]);
            LocalFree(arguments);
            return ReplaceLauncher(parentId, target);
        }
        const bool skipLauncherReplacement = arguments && argumentCount == 2 &&
            std::wstring(arguments[1]) == L"--skip-launcher-replace-once";
        if (arguments) LocalFree(arguments);
        return RunLauncher(skipLauncherReplacement);
    } catch (const std::exception& error) {
        MessageBoxW(nullptr, Widen(error.what()).c_str(), L"Le Monde de Lila - Mise Ã  jour",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);
        return 1;
    }
}

#endif
