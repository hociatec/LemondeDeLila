void TestSessionValidation()
{
    lila::modules::session::domain::Session session;
    Expect(!session.IsAuthenticated(), "Session vide ne doit pas etre authentifiee");

    session.userId = lila::shared::domain::UserId{42};
    session.username = "testuser";
    session.token = "invalid-token";
    Expect(!session.IsAuthenticated(), "Token invalide ne doit pas etre accepte");

    session.token = "header.payload.signature";
    Expect(session.IsAuthenticated(), "Token JWT structurellement valide attendu");

    session.expiresAt = 1000;
    Expect(!session.IsAuthenticated(), "Session expiree ne doit pas etre authentifiee");

    session.expiresAt = 4102444800LL;
    Expect(session.IsAuthenticated(), "Session future doit rester authentifiee");

    std::cout << "[TEST PASSED] SessionValidation\n";
}

void TestJwtPayloadExpiration()
{
    const std::string valid =
        "header.eyJ1c2VybmFtZSI6ImFsaWNlIiwiaWQiOjcsImV4cCI6NDEwMjQ0NDgwMH0.signature";
    Expect(
        lila::shared::security::ReadJwtExpiration(valid) == 4102444800LL,
        "Expiration JWT attendue");
    const std::string withRoles =
        "header.eyJ1c2VybmFtZSI6ImFsaWNlIiwiaWQiOjcsImV4cCI6NDEwMjQ0NDgwMCwicm9sZXMiOlsiUk9MRV9VU0VSIiwiUk9MRV9BRE1JTiJdfQ.signature";
    const auto roles = lila::shared::security::ReadJwtRoles(withRoles);
    Expect(roles.size() == 2 && roles[1] == "ROLE_ADMIN", "Roles JWT attendus");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::shared::security::ReadJwtExpiration("header.payload.signature"));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Payload JWT invalide devait etre refuse");
    std::cout << "[TEST PASSED] JwtPayloadExpiration\n";
}

void TestOptionsStateNormalization()
{
    lila::modules::options::domain::OptionsState options;
    options.audio.soundAmbienceVolume = 150;
    options.internal.admin.adminChatModerationLoadLimit = -5;
    options.Normalize();

    Expect(options.audio.soundAmbienceVolume == 100, "Volume ambiance doit etre borne a 100");
    Expect(options.internal.admin.adminChatModerationLoadLimit == 1, "Limite moderation doit etre bornee a 1");
    Expect(
        options.schemaVersion == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema version par defaut inattendue");

    std::cout << "[TEST PASSED] OptionsStateNormalization\n";
}

void TestDomainTypes()
{
    lila::shared::domain::UserId id1{100};
    lila::shared::domain::UserId id2{100};
    lila::shared::domain::UserId id3{200};

    Expect(id1 == id2, "UserId egaux attendus");
    Expect(id1 != id3, "UserId differents attendus");
    Expect(id1.IsValid(), "UserId positif attendu valide");

    Expect(
        lila::shared::domain::ProfileVisibilityFromString("friends") == lila::shared::domain::ProfileVisibility::Friends,
        "Mapping friends invalide");
    Expect(
        std::string(lila::shared::domain::ProfileVisibilityToString(lila::shared::domain::ProfileVisibility::Private)) == "private",
        "Mapping private invalide");

    std::cout << "[TEST PASSED] DomainTypes\n";
}

void TestSecurityWipe()
{
    std::string secret = "SensitivePassword123";
    lila::shared::security::SecureWipeString(secret);
    Expect(secret.empty(), "SecureWipeString doit vider la chaine");

    std::cout << "[TEST PASSED] SecurityWipe\n";
}

void TestPersistedSecretsRejectPlaintext()
{
    bool rejected = false;
    try
    {
        static_cast<void>(lila::shared::security::UnprotectSecret(
            "legacy-plaintext-token"));
    }
    catch (const std::runtime_error& error)
    {
        rejected = true;
        Expect(
            std::string(error.what()) == lila::shared::errors::SecretUnprotectionFailed,
            "Erreur de dechiffrement attendue");
    }
    Expect(rejected, "Un secret persiste en clair devait etre refuse");

    std::cout << "[TEST PASSED] PersistedSecretsRejectPlaintext\n";
}

void TestSecureDeleteFileRemovesContent()
{
    const auto path = std::filesystem::current_path() / "secure-delete-test.txt";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        file << "refresh-token-that-must-not-remain";
    }

    lila::shared::security::SecureDeleteFile(path.string());
    Expect(!std::filesystem::exists(path), "Le fichier sensible devait etre supprime");

    std::cout << "[TEST PASSED] SecureDeleteFileRemovesContent\n";
}

void TestSensitiveFilePermissions()
{
    const auto path = std::filesystem::current_path() / "sensitive-permissions-test.txt";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        file << "protected";
    }

    lila::shared::security::HardenFilePermissions(path.string());
#ifndef _WIN32
    const auto permissions = std::filesystem::status(path).permissions();
    using Perms = std::filesystem::perms;
    Expect((permissions & (Perms::group_all | Perms::others_all)) == Perms::none,
        "Les permissions groupe/autres devaient etre retirees");
#endif
    std::filesystem::remove(path);

    std::cout << "[TEST PASSED] SensitiveFilePermissions\n";
}

void TestSessionStorageSchemaVersion()
{
    using namespace lila::modules::session::infrastructure;
    Expect(fields::CurrentSchemaVersion > fields::LegacySchemaVersion,
        "La session persistante doit avoir une version de schema explicite");
    Expect(!fields::SchemaVersion.empty(), "Le champ schemaVersion est requis");

    std::cout << "[TEST PASSED] SessionStorageSchemaVersion\n";
}

void TestJsonFileStorageRejectsOversizedFiles()
{
    const std::filesystem::path path = std::filesystem::current_path() / "oversized-test.json";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        const std::vector<char> data((1024 * 1024) + 1, 'x');
        file.write(data.data(), static_cast<std::streamsize>(data.size()));
    }

    nlohmann::json content;
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::persistence::JsonFileStorage::ReadIfExists(path, content));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::JsonFileTooLarge, "JsonFileTooLarge attendu");
    }

    std::filesystem::remove(path);
    Expect(threw, "Lecture fichier JSON surdimensionne devait echouer");

    std::cout << "[TEST PASSED] JsonFileStorageRejectsOversizedFiles\n";
}

void TestJsonFileStorageRejectsCorruptedFiles()
{
    const std::filesystem::path path = std::filesystem::current_path() / "corrupted-test.json";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        file << "{ invalid json";
    }

    nlohmann::json content;
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::persistence::JsonFileStorage::ReadIfExists(path, content));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()).find(lila::shared::errors::CorruptedJsonFile) != std::string::npos, "CorruptedJsonFile attendu");
    }

    std::filesystem::remove(path);
    Expect(threw, "Lecture fichier corrompu devait echouer");

    std::cout << "[TEST PASSED] JsonFileStorageRejectsCorruptedFiles\n";
}

void TestJsonParseErrorsDoNotExposePayloads()
{
    const std::string secret = "access-token-that-must-stay-private";
    bool rejected = false;
    try
    {
        static_cast<void>(lila::shared::data::json::ParseDocument(
            "{\"token\":\"" + secret + "\",",
            "Payload réseau invalide."));
    }
    catch (const lila::shared::errors::AppException& error)
    {
        rejected = true;
        Expect(std::string(error.what()).find(secret) == std::string::npos &&
                error.Error().DiagnosticDetails().find(secret) == std::string::npos,
            "Une erreur JSON ne doit jamais recopier le payload sensible");
    }
    Expect(rejected, "Le JSON malforme devait etre refuse");

    std::cout << "[TEST PASSED] JsonParseErrorsDoNotExposePayloads\n";
}
