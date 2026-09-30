#include <chrono>
#include <iostream>
#include <stdexcept>

#include "modules/update/domain/UpdateRetryPolicy.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}
}

int main()
{
    try
    {
        using namespace std::chrono_literals;
        using lila::modules::update::WaitForUpdateRetry;

        std::chrono::milliseconds waited{};
        const bool completed = WaitForUpdateRetry(20s, [] { return false; },
            [&waited](auto slice) { waited += slice; });
        Expect(completed && waited == 5s,
            "Update retry waits must be capped at five seconds.");

        waited = 0ms;
        const bool cancelled = WaitForUpdateRetry(5s,
            [&waited] { return waited >= 125ms; },
            [&waited](auto slice) { waited += slice; });
        Expect(!cancelled && waited == 150ms,
            "Update retry cancellation must be observed within one polling slice.");

        waited = 0ms;
        Expect(WaitForUpdateRetry(-1ms, [] { return false; },
                [&waited](auto slice) { waited += slice; }) && waited == 0ms,
            "Negative retry delays must not block.");

        std::cout << "Update retry policy tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Update retry policy test failed: " << error.what() << '\n';
        return 1;
    }
}
