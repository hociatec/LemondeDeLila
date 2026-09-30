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
        "L'archive temporaire doit conserver une extension ZIP explicite");

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

void TestArchivePathsStayInsideStaging()
{
    using lila::modules::update::IsSafeArchivePath;
    Expect(IsSafeArchivePath("resources/sounds/theme.ogg"),
        "Un chemin ZIP relatif normal doit etre accepte");
    Expect(IsSafeArchivePath("resources/"),
        "Une entree de dossier ZIP doit etre acceptee");
    Expect(!IsSafeArchivePath("../outside.exe"),
        "Une traversee ZIP doit etre rejetee");
    Expect(!IsSafeArchivePath("folder/./file.exe"),
        "Un segment ZIP ambigu doit etre rejete");
    Expect(!IsSafeArchivePath("folder//file.exe"),
        "Un segment ZIP vide doit etre rejete");
    Expect(!IsSafeArchivePath("payload.exe:stream"),
        "Un flux NTFS alternatif doit etre rejete");
    Expect(!IsSafeArchivePath("C:\\payload.exe"),
        "Un chemin ZIP absolu Windows doit etre rejete");
    Expect(!IsSafeArchivePath(std::string("file\0.exe", 9)),
        "Un chemin ZIP contenant un octet nul doit etre rejete");
}

void TestArchiveBudgetsRejectCorruptionAndZipBombs()
{
    using namespace lila::modules::update;
    Expect(IsArchiveDirectoryLayoutSafe(1000, 800, 200, 2),
        "Un repertoire ZIP borne doit etre accepte");
    Expect(!IsArchiveDirectoryLayoutSafe(1000, 900, 200, 2),
        "Un repertoire ZIP tronque doit etre rejete");
    Expect(!IsArchiveDirectoryLayoutSafe(1000, 0, 1, MaximumArchiveEntries + 1),
        "Un nombre excessif de fichiers doit etre rejete");
    Expect(IsArchiveExpansionSafe(50ULL * 1024ULL * 1024ULL,
            500ULL * 1024ULL * 1024ULL, 10),
        "Une expansion ZIP raisonnable doit etre acceptee");
    Expect(!IsArchiveExpansionSafe(1024, 600ULL * 1024ULL * 1024ULL, 1),
        "Une zip bomb doit etre rejetee");
    Expect(MaximumExtractedEntryBytes < MaximumExtractedBytes,
        "Chaque entree doit avoir une limite plus stricte que l'archive");
}

void TestMalformedAndModifiedManifestsAreRejected()
{
    using namespace lila::modules::update;
    for (const auto& raw : {std::string("{broken"), std::string("[]"),
             std::string(R"({"schemaVersion":2})")})
    {
        bool rejected = false;
        try { static_cast<void>(ParseUpdateManifest(raw)); }
        catch (const std::exception&) { rejected = true; }
        Expect(rejected, "Un manifeste malforme doit etre rejete");
    }
    bool oversizedRejected = false;
    try { static_cast<void>(ParseUpdateManifest(std::string(MaximumUpdateManifestBytes + 1, 'x'))); }
    catch (const std::exception&) { oversizedRejected = true; }
    Expect(oversizedRejected, "Un manifeste trop volumineux doit etre rejete");

    UpdateManifest original{
        "release", "2.0.0", 7, "2026-01-01T00:00:00.000Z", {}, {},
        "https://updates.example/client.zip", 100, std::string(64, 'a'), "AA=="};
    auto modified = original;
    modified.sha256[0] = 'b';
    Expect(CanonicalUpdateSignature(original) != CanonicalUpdateSignature(modified),
        "La modification du contenu doit invalider les donnees signees");
    modified = original;
    modified.size++;
    Expect(CanonicalUpdateSignature(original) != CanonicalUpdateSignature(modified),
        "La taille de l'artefact doit etre couverte par la signature");
    Expect(IsUpdateSequenceAllowed(8, 7) && IsUpdateSequenceAllowed(7, 7) &&
            !IsUpdateSequenceAllowed(6, 7),
        "La politique anti-rollback doit refuser une sequence inferieure");
}
}

int main()
{
    try
    {
        TestUpdateProtocolRejectsUnsafeMetadata();
        TestStagedArchiveUsesZipExtension();
        TestArchivePathsStayInsideStaging();
        TestArchiveBudgetsRejectCorruptionAndZipBombs();
        TestMalformedAndModifiedManifestsAreRejected();
        std::cout << "Update protocol tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "Update protocol test failed: " << error.what() << '\n';
        return 1;
    }
}
