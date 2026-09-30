#include <iostream>
#include <stdexcept>

#include "modules/session/domain/SessionResumePolicy.h"
#include "modules/session/infrastructure/SessionStorageMigration.h"

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
        using namespace lila::modules::session;
        Expect(infrastructure::ResolveSessionStorageMigration(std::nullopt) ==
                infrastructure::SessionStorageMigration::LegacyV0ToV1,
            "A versionless legacy session must use the explicit v0-to-v1 migration.");
        Expect(infrastructure::ResolveSessionStorageMigration(1) ==
                infrastructure::SessionStorageMigration::CurrentV1,
            "The current session schema must not be migrated.");
        bool futureRejected = false;
        try { static_cast<void>(infrastructure::ResolveSessionStorageMigration(2)); }
        catch (const std::runtime_error&) { futureRejected = true; }
        Expect(futureRejected, "An unknown session schema must fail closed.");

        constexpr std::int64_t now = 10'000;
        Expect(!domain::IsResumeOnceWindowValid(0, now),
            "A missing one-shot deadline must be rejected.");
        Expect(!domain::IsResumeOnceWindowValid(now - 1, now),
            "An expired one-shot deadline must be rejected.");
        Expect(domain::IsResumeOnceWindowValid(now, now),
            "The exact one-shot deadline boundary must be accepted.");
        Expect(domain::IsResumeOnceWindowValid(
                now + domain::ResumeOnceLifetimeSeconds, now),
            "The maximum one-shot lifetime boundary must be accepted.");
        Expect(!domain::IsResumeOnceWindowValid(
                now + domain::ResumeOnceLifetimeSeconds + 1, now),
            "A forged overlong one-shot deadline must be rejected.");

        std::cout << "Session persistence policy tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Session persistence policy test failed: " << error.what() << '\n';
        return 1;
    }
}
