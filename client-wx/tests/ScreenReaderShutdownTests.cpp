#include <cassert>
#include <chrono>
#include <future>
#include <memory>
#include <string_view>

#include "shared/accessibility/infrastructure/ScreenReaderCallGate.h"
#include "shared/concurrency/application/BackgroundExecutor.h"

using namespace std::chrono_literals;
using lila::shared::accessibility::ScreenReaderCallGate;

int main(int argc, char** argv)
{
    if (argc > 1 && std::string_view(argv[1]) == "--permanent-rpc")
    {
        ScreenReaderCallGate gate;
        const auto never = std::make_shared<std::promise<void>>();
        const auto wait = never->get_future().share();
        assert(!gate.Invoke(30ms, [never, wait] { wait.wait(); return true; }));
        // CTest verifies that the process exits even though the external call never returns.
        return 0;
    }

    ScreenReaderCallGate gate;
    assert(gate.Invoke(1s, [] { return true; }));
    assert(!gate.Invoke(1s, [] { return false; }));
    assert(!gate.Invoke(1s, []() -> bool { throw 42; }));
    assert(gate.Invoke(1s, [] { return true; }));

    auto release = std::make_shared<std::promise<void>>();
    auto wait = release->get_future().share();
    auto entered = std::make_shared<std::promise<void>>();
    auto started = entered->get_future();
    auto destroyed = std::make_shared<std::promise<void>>();
    auto destruction = destroyed->get_future();
    struct OwnedResource
    {
        std::shared_ptr<std::promise<void>> destroyed;
        ~OwnedResource() { destroyed->set_value(); }
    };
    auto resource = std::make_shared<OwnedResource>();
    resource->destroyed = destroyed;
    std::weak_ptr<OwnedResource> weakResource = resource;

    const auto beginning = std::chrono::steady_clock::now();
    {
        auto shutdownGate = std::make_shared<ScreenReaderCallGate>();
        lila::shared::concurrency::BackgroundExecutor executor({1, 4});
        assert(executor.Submit(std::make_shared<std::stop_source>(),
            lila::shared::concurrency::BackgroundTaskPriority::High,
            [shutdownGate, resource, entered, wait]
            {
                assert(!shutdownGate->Invoke(100ms, [resource, entered, wait]
                {
                    entered->set_value();
                    wait.wait();
                    return true;
                }));
            }));
        resource.reset();
        assert(started.wait_for(1s) == std::future_status::ready);
        executor.Shutdown();
        bool duplicateCalled = false;
        assert(!shutdownGate->Invoke(1s, [&] { duplicateCalled = true; return true; }));
        assert(!duplicateCalled);
    }
    assert(std::chrono::steady_clock::now() - beginning < 2s);
    assert(!weakResource.expired()); // DLL/call arguments survive both timeout and owner destruction.
    release->set_value();
    assert(destruction.wait_for(1s) == std::future_status::ready);
    assert(weakResource.expired());
}
