#include <iostream>
#include <stdexcept>
#include <string>

#include "modules/update/domain/UpdateProtocol.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

void TestUpdateProtocolRejectsUnsafeMetadata()
{
    using namespace lila::modules::update;
    Expect(IsUpdateNewer("1.10.0", "1.9.99"),
        "La comparaison de version ne doit pas etre lexicographique");
    Expect(!IsSafeReleaseId("../outside"),
        "Un identifiant de release traversant doit etre rejete");

    const std::string manifest = R"json({
        "schemaVersion": 2,
        "product": "client-wx",
        "platform": "windows",
        "architecture": "x64",
        "channel": "stable",
        "releaseId": "1.4.2-release",
        "version": "1.4.2",
        "sequence": 42,
        "publishedAt": "2026-08-24T12:00:00.000Z",
        "mandatoryAt": null,
        "minimumVersion": "1.4.0",
        "artifact": {
            "url": "https://updates.example/client.zip",
            "size": 1234,
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "signature": "AA==",
            "signatureAlgorithm": "rsa-pkcs1-sha256"
        }
    })json";
    const auto parsed = ParseUpdateManifest(manifest);
    const auto canonical = CanonicalUpdateSignature(parsed);
    const std::string expectedCanonical =
        "lila-client-wx-manifest-v2\n"
        "product=client-wx\n"
        "platform=windows\n"
        "architecture=x64\n"
        "channel=stable\n"
        "releaseId=1.4.2-release\n"
        "version=1.4.2\n"
        "sequence=42\n"
        "publishedAt=2026-08-24T12:00:00.000Z\n"
        "mandatoryAt=-\n"
        "minimumVersion=1.4.0\n"
        "artifactSize=1234\n"
        "artifactSha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    Expect(canonical == expectedCanonical,
        "Le contrat signe doit rester identique entre le client, le backend et la CI");

    bool rejected = false;
    try
    {
        static_cast<void>(ParseUpdateVersion("1.02.3"));
    }
    catch (...)
    {
        rejected = true;
    }
    Expect(rejected, "Une version ambigue doit etre rejetee");
}

void TestStagedArchiveUsesZipExtension()
{
    using namespace lila::modules::update;
    Expect(BuildStagedUpdateArchiveFileName("1.4.2-release") ==
            "1.4.2-release.download.zip",
        "L'archive temporaire doit conserver une extension compatible avec Expand-Archive");

    bool rejected = false;
    try
    {
        static_cast<void>(BuildStagedUpdateArchiveFileName("../outside"));
    }
    catch (...)
    {
        rejected = true;
    }
    Expect(rejected,
        "Le nom d'archive temporaire doit rejeter une release dangereuse");
}
}

int main()
{
    try
    {
        TestUpdateProtocolRejectsUnsafeMetadata();
        TestStagedArchiveUsesZipExtension();
        std::cout << "Update protocol tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Update protocol test failed: " << error.what() << '\n';
        return 1;
    }
}
