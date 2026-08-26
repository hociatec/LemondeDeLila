#include <thread>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
namespace
{
void ClearReleaseDiagnostics(const fs::path& versions) noexcept
{
    try {
        if (!fs::is_directory(versions)) return;
        for (const auto& entry : fs::directory_iterator(versions)) {
            if (!entry.is_directory()) continue;
            std::error_code ignored;
            fs::remove(entry.path() / L"client.log", ignored);
            fs::remove(entry.path() / L"client-crash.log", ignored);
        }
    } catch (...) {
    }
}
}

Process::~Process() { if (handle) CloseHandle(handle); }

Process::Process(Process&& other) noexcept : handle(other.handle), id(other.id)
{
    other.handle = nullptr;
    other.id = 0;
}

Process& Process::operator=(Process&& other) noexcept
{
    if (this != &other)
    {
        if (handle) CloseHandle(handle);
        handle = other.handle;
        id = other.id;
        other.handle = nullptr;
        other.id = 0;
    }
    return *this;
}

Process LaunchClient(const fs::path& directory)
{
    // Keep diagnostics for one launch only, including across retained and
    // rolled-back releases. The launcher has stopped the previous client
    // before reaching this point.
    ClearReleaseDiagnostics(directory.parent_path());
    const fs::path executable = directory / AppExecutable;
    std::wstring command = L"\"" + executable.wstring() + L"\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION information{};
    if (!CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr,
            FALSE, 0, nullptr, directory.c_str(), &startup, &information)) {
        throw std::runtime_error("Unable to launch client.");
    }
    // Le client est un enfant du lanceur démarré explicitement par
    // l'utilisateur. Autoriser cet enfant à restaurer sa fenêtre évite que
    // Windows la laisse derrière les autres applications.
    static_cast<void>(AllowSetForegroundWindow(information.dwProcessId));
    CloseHandle(information.hThread);
    Process result;
    result.handle = information.hProcess;
    result.id = information.dwProcessId;
    return result;
}

bool WaitForHealthy(const Process& process)
{
    const std::wstring name = L"Local\\LeMondeDeLilaWX.Healthy." + std::to_wstring(process.id);
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(30);
    while (std::chrono::steady_clock::now() < deadline) {
        if (WaitForSingleObject(process.handle, 0) == WAIT_OBJECT_0) return false;
        HANDLE signal = OpenEventW(SYNCHRONIZE, FALSE, name.c_str());
        if (signal) {
            const bool healthy = WaitForSingleObject(signal, 0) == WAIT_OBJECT_0;
            CloseHandle(signal);
            if (healthy) return true;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    return false;
}

BOOL CALLBACK CloseClientWindow(HWND window, LPARAM processId)
{
    DWORD owner = 0;
    GetWindowThreadProcessId(window, &owner);
    if (owner == static_cast<DWORD>(processId)) PostMessageW(window, WM_CLOSE, 0, 0);
    return TRUE;
}

void StopForUpdate(Process& process)
{
    const std::wstring name = L"Local\\LeMondeDeLilaWX.Update." + std::to_wstring(process.id);
    HANDLE signal = CreateEventW(nullptr, TRUE, TRUE, name.c_str());
    EnumWindows(CloseClientWindow, static_cast<LPARAM>(process.id));
    if (WaitForSingleObject(process.handle, 30 * 1000) != WAIT_OBJECT_0) {
        TerminateProcess(process.handle, 0x4C494C41);
        WaitForSingleObject(process.handle, 5000);
    }
    if (signal) CloseHandle(signal);
}

LauncherReplacement SpawnLauncherReplacement(
    const fs::path& candidate,
    const fs::path& target)
{
    if (!fs::is_regular_file(candidate)) return LauncherReplacement::Failed;
    try {
        if (Sha256(candidate) == Sha256(target)) return LauncherReplacement::NotNeeded;
    } catch (...) {
        return LauncherReplacement::Failed;
    }
    std::wstring command = L"\"" + candidate.wstring() + L"\" --replace-launcher " +
        std::to_wstring(GetCurrentProcessId()) + L" \"" + target.wstring() + L"\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(candidate.c_str(), command.data(), nullptr, nullptr,
            FALSE, CREATE_NO_WINDOW, nullptr, candidate.parent_path().c_str(),
            &startup, &process)) return LauncherReplacement::Failed;
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return LauncherReplacement::Spawned;
}

int ReplaceLauncher(DWORD parentProcessId, const fs::path& target)
{
    const fs::path source = fs::weakly_canonical(ExecutablePath());
    const fs::path versions = source.parent_path().parent_path();
    const fs::path root = versions.parent_path();
    if (source.filename() != L"lila_launcher.exe" ||
        versions.filename() != L"versions" ||
        fs::weakly_canonical(target) != fs::weakly_canonical(root / L"lila_launcher.exe")) {
        return 4;
    }
    HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, parentProcessId);
    if (parent) {
        WaitForSingleObject(parent, 30 * 1000);
        CloseHandle(parent);
    }
    const fs::path temporary = target.wstring() + L".new";
    fs::copy_file(source, temporary, fs::copy_options::overwrite_existing);
    bool replaced = false;
    for (int attempt = 0; attempt < 8; ++attempt) {
        if (MoveFileExW(temporary.c_str(), target.c_str(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            replaced = true;
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(250 * (attempt + 1)));
    }
    int resultCode = 0;
    if (!replaced) {
        fs::remove(temporary);
        resultCode = 2;
    }
    std::wstring command = L"\"" + target.wstring() + L"\"";
    if (!replaced) command += L" --skip-launcher-replace-once";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(target.c_str(), command.data(), nullptr, nullptr,
            FALSE, 0, nullptr, target.parent_path().c_str(), &startup, &process)) return 3;
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return resultCode;
}
}
