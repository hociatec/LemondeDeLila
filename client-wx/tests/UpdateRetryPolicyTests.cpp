#include <chrono>
#include <iostream>
#include <stdexcept>

#include "modules/update/domain/UpdateRetryPolicy.h"
#include "modules/update/application/UpdateManifestDownload.h"

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
        using lila::modules::update::DownloadUpdateManifestWithRetry;

        int attempts = 0;
        std::chrono::milliseconds downloadWait{};
        const std::string manifest = R"({"schemaVersion":2})";
        const auto downloaded = DownloadUpdateManifestWithRetry(
            [&]() -> std::string {
                ++attempts;
                if (attempts == 1) return "";
                if (attempts == 2) return " \t\r\n";
                return manifest;
            },
            [&](auto delay) { downloadWait += delay; });
        Expect(downloaded == manifest && attempts == 3 && downloadWait == 1500ms,
            "Empty responses must be retried and a later manifest preserved exactly.");

        attempts = 0;
        downloadWait = 0ms;
        bool rejectedEmpty = false;
        try
        {
            DownloadUpdateManifestWithRetry(
                [&] { ++attempts; return std::string(" \r\n"); },
                [&](auto delay) { downloadWait += delay; });
        }
        catch (const std::runtime_error& error)
        {
            rejectedEmpty = std::string(error.what()).find("empty manifest") != std::string::npos;
        }
        Expect(rejectedEmpty && attempts == 3 && downloadWait == 1500ms,
            "Persistent empty responses must fail with a clear error after three attempts.");

        attempts = 0;
        const auto recovered = DownloadUpdateManifestWithRetry(
            [&]() -> std::string {
                if (++attempts == 1) throw std::runtime_error("network failure");
                return manifest;
            }, [](auto) {});
        Expect(recovered == manifest && attempts == 2,
            "Transport failures must still be retried.");

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
