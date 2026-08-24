#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include "modules/update/infrastructure/launcher/UpdateLauncher.h"

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int)
{
    return lila::modules::update::RunUpdateLauncher();
}

#endif
