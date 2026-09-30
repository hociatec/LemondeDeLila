#include <atomic>
#include <cassert>
#include <chrono>
#include <cstddef>
#include <thread>

#include <wx/app.h>
#include <wx/frame.h>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#endif

#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/ui/presentation/BackgroundTask.h"

class BackgroundTaskLifecycleApp final : public wxApp
{
public:
    bool OnInit() override { return true; }
};
wxIMPLEMENT_APP_NO_MAIN(BackgroundTaskLifecycleApp);

namespace
{
using namespace std::chrono_literals;

void WaitUntilIdle(lila::shared::concurrency::BackgroundExecutor& executor)
{
    for (int attempt = 0; attempt < 400; ++attempt)
    {
        const auto stats = executor.Stats();
        if (stats.active == 0 && stats.queued == 0) return;
        std::this_thread::sleep_for(2ms);
    }
    assert(false && "background task did not become idle");
}

#ifdef _WIN32
DWORD ProcessHandleCount()
{
    DWORD count = 0;
    assert(GetProcessHandleCount(GetCurrentProcess(), &count));
    return count;
}

DWORD GuiResourceCount(DWORD kind)
{
    return GetGuiResources(GetCurrentProcess(), kind);
}
#endif
}

int main(int argc, char** argv)
{
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());

    lila::shared::concurrency::BackgroundExecutor executor({2, 64});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);
    std::atomic<int> staleCompletions = 0;

#ifdef _WIN32
    auto* warmup = new wxFrame(nullptr, wxID_ANY, "background-warmup");
    warmup->Destroy();
    wxYield();
    const auto handlesBefore = ProcessHandleCount();
    const auto gdiBefore = GuiResourceCount(GR_GDIOBJECTS);
    const auto userBefore = GuiResourceCount(GR_USEROBJECTS);
#endif
    for (int iteration = 0; iteration < 50; ++iteration)
    {
        std::atomic<bool> entered = false;
        std::atomic<bool> release = false;
        auto* owner = new wxFrame(nullptr, wxID_ANY, "background-owner");
        const auto handle = lila::shared::ui::RunBackgroundTask(
            owner,
            [&]
            {
                entered.store(true, std::memory_order_release);
                while (!release.load(std::memory_order_acquire))
                    std::this_thread::yield();
            },
            [&](std::string) { ++staleCompletions; });
        assert(handle != nullptr && handle->WasAccepted());
        while (!entered.load(std::memory_order_acquire))
            std::this_thread::yield();

        owner->Destroy();
        wxYield();
        release.store(true, std::memory_order_release);
        WaitUntilIdle(executor);
        wxYield();
    }

    assert(staleCompletions.load() == 0);
#ifdef _WIN32
    const auto handlesAfter = ProcessHandleCount();
    assert(handlesAfter <= handlesBefore + 8);
    assert(GuiResourceCount(GR_GDIOBJECTS) <= gdiBefore + 4);
    assert(GuiResourceCount(GR_USEROBJECTS) <= userBefore + 4);
#endif

    lila::shared::concurrency::UninstallBackgroundExecutor();
    executor.Shutdown();
    static_cast<void>(wxTheApp->OnExit());
    wxEntryCleanup();
}
