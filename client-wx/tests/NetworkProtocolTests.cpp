#include <iostream>
#include <cassert>
#include <string>

#include "shared/domain/DomainTypes.h"
#include "shared/logging/Logger.h"
#include "shared/security/SecurityUtils.h"
#include "modules/session/domain/Session.h"
#include "modules/options/domain/OptionsState.h"

void TestSessionValidation()
{
    lila::modules::session::domain::Session session;
    assert(!session.IsAuthenticated());

    session.userId = 42;
    session.username = "testuser";
    session.token = "invalid-token";
    assert(!session.IsAuthenticated());

    session.token = "header.payload.signature";
    assert(session.IsAuthenticated());

    session.expiresAt = 1000; // past timestamp
    assert(!session.IsAuthenticated());

    session.expiresAt = 4102444800LL; // far future timestamp
    assert(session.IsAuthenticated());

    std::cout << "[TEST PASSED] SessionValidation\n";
}

void TestOptionsStateNormalization()
{
    lila::modules::options::domain::OptionsState options;
    options.audio.soundAmbienceVolume = 150;
    options.admin.adminChatModerationLoadLimit = -5;
    options.Normalize();

    assert(options.audio.soundAmbienceVolume == 100);
    assert(options.admin.adminChatModerationLoadLimit == 1);
    assert(options.schemaVersion == 2);

    std::cout << "[TEST PASSED] OptionsStateNormalization\n";
}

void TestDomainTypes()
{
    lila::shared::domain::UserId id1{100};
    lila::shared::domain::UserId id2{100};
    lila::shared::domain::UserId id3{200};

    assert(id1 == id2);
    assert(id1 != id3);
    assert(id1.IsValid());

    assert(lila::shared::domain::ProfileVisibilityFromString("friends") == lila::shared::domain::ProfileVisibility::Friends);
    assert(std::string(lila::shared::domain::ProfileVisibilityToString(lila::shared::domain::ProfileVisibility::Private)) == "private");

    std::cout << "[TEST PASSED] DomainTypes\n";
}

void TestSecurityWipe()
{
    std::string secret = "SensitivePassword123";
    lila::shared::security::SecureWipeString(secret);
    assert(secret.empty());

    std::cout << "[TEST PASSED] SecurityWipe\n";
}

int main()
{
    std::cout << "Running automated unit tests for client-wx...\n";
    TestSessionValidation();
    TestOptionsStateNormalization();
    TestDomainTypes();
    TestSecurityWipe();
    std::cout << "All tests completed successfully!\n";
    return 0;
}
