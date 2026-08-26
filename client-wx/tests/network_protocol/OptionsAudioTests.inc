void TestOptionsCodecMigratesLegacyFieldsAndSchema()
{
    const nlohmann::json legacyDocument = {
        {"confirmLogout", true},
        {"muteAll", true},
        {"schemaVersion", 1},
        {"currentVersion", "1.2.3"}
    };

    const auto state = lila::modules::options::infrastructure::json::Parse(legacyDocument);
    Expect(state.general.confirmExit, "confirmExit migre attendu");
    Expect(state.general.repairBrokenAccents, "repairBrokenAccents doit etre actif par defaut");
    Expect(state.audio.muteAll, "muteAll migre attendu");
    Expect(state.runtime.currentVersion == std::optional<std::string>("1.2.3"), "currentVersion migree attendue");
    Expect(
        state.schemaVersion == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema version migree invalide");

    const auto serialized = lila::modules::options::infrastructure::json::Serialize(state);
    Expect(
        serialized.at("schemaVersion") == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema serialise invalide");
    Expect(serialized.at("general").at("confirmExit") == true, "confirmExit serialise attendu");
    Expect(serialized.at("general").at("repairBrokenAccents") == true, "repairBrokenAccents serialise attendu");
    Expect(!serialized.contains("confirmLogout"), "confirmLogout legacy ne doit plus etre serialise");
    Expect(serialized.at("currentVersion") == "1.2.3", "currentVersion top-level attendue");
    Expect(serialized.at("runtime").at("currentVersion") == "1.2.3", "currentVersion runtime attendue");
    Expect(
        serialized.at("internal").at("admin").at("adminChatModerationLoadLimit") == 200,
        "Limite admin serialisee inattendue");

    std::cout << "[TEST PASSED] OptionsCodecMigratesLegacyFieldsAndSchema\n";
}

void TestSoundCatalogAndPerCueOptionsRoundTrip()
{
    const auto catalog = lila::modules::audio::domain::GetSoundCatalog();
    const auto options = lila::modules::audio::presentation::GetSoundOptions();
    Expect(
        catalog.size() == static_cast<std::size_t>(lila::modules::audio::domain::SoundCue::Count),
        "Tous les sons doivent etre presents dans le catalogue");
    Expect(options.size() == catalog.size(), "Chaque son doit avoir un libelle d'option");

    std::unordered_set<std::string> keys;
    for (std::size_t index = 0; index < catalog.size(); ++index)
    {
        const auto& descriptor = catalog[index];
        Expect(keys.insert(std::string(descriptor.key)).second, "Cle de son dupliquee");
        Expect(options[index].cue == descriptor.cue, "Ordre du catalogue d'options invalide");
        Expect(!options[index].label.empty(), "Libelle de son requis");
        const auto fileName = lila::modules::audio::infrastructure::GetLocalSoundFile(descriptor.cue);
        Expect(!fileName.empty(), "Fichier sonore de repli requis");
        Expect(
            std::filesystem::exists(std::filesystem::current_path() / "resources" / "sounds" / fileName),
            "Fichier sonore ou fichier de repli manquant");
    }

    lila::modules::options::domain::OptionsState state;
    state.audio.cues["clientConnected"] = {false, 37};
    state.audio.cues["tableAmbience20"] = {true, 72};
    const auto parsed = lila::modules::options::infrastructure::json::Parse(
        lila::modules::options::infrastructure::json::Serialize(state));
    Expect(!parsed.audio.cues.at("clientConnected").enabled, "Activation individuelle non conservee");
    Expect(parsed.audio.cues.at("clientConnected").volume == 37, "Volume individuel non conserve");
    Expect(parsed.audio.cues.at("tableAmbience20").volume == 72, "Volume ambiance de table non conserve");

    auto normalized = parsed;
    normalized.audio.cues.at("clientConnected").volume = 500;
    normalized.Normalize();
    Expect(normalized.audio.cues.at("clientConnected").volume == 100, "Volume individuel non borne");

    std::cout << "[TEST PASSED] SoundCatalogAndPerCueOptionsRoundTrip\n";
}

void TestAudioSettingsAndServiceRouting()
{
    using namespace lila::modules::audio;
    FixedAudioSettingsProvider settings;
    settings.settings.ambienceVolume = 30;
    settings.settings.splitAmbienceVolume = false;
    settings.settings.cues[static_cast<std::size_t>(domain::SoundCue::MainMenuMusic)] = {true, 50};

    const auto* menu = domain::FindSoundDescriptor(domain::SoundCue::MainMenuMusic);
    Expect(menu != nullptr, "Son du menu attendu");
    const auto commonVolume = application::ResolvePlaybackSettings(*menu, settings.settings);
    Expect(commonVolume.enabled && commonVolume.volume > 0.149F && commonVolume.volume < 0.151F,
        "Volume ambiance commun et individuel attendu");

    settings.settings.splitAmbienceVolume = true;
    settings.settings.menuAmbienceVolume = 80;
    const auto splitVolume = application::ResolvePlaybackSettings(*menu, settings.settings);
    Expect(splitVolume.volume > 0.399F && splitVolume.volume < 0.401F,
        "Volume ambiance menu separe attendu");

    RecordingAudioBackend backend;
    application::AudioService service(backend, settings);
    Expect(backend.preloaded.size() == 8, "Prechauffage des sons courants attendu");

    service.Play(domain::SoundCue::Navigation);
    Expect(backend.played.size() == 1 && backend.played.front().first == domain::SoundCue::Navigation,
        "Routage du son de navigation attendu");
    service.SetBackground(domain::AudioBackground::MainMenu);
    Expect(backend.loops.size() == 1 &&
        backend.loops.front().first == domain::SoundCue::MainMenuMusic,
        "Routage de l'ambiance menu attendu");
    settings.settings.tableAmbienceVolume = 20;
    service.StartLoop(domain::SoundCue::TableAmbience20);
    Expect(backend.loops.back().first == domain::SoundCue::TableAmbience20,
        "Toutes les ambiances de table doivent pouvoir etre lancees");

    settings.settings.muteAll = true;
    service.Play(domain::SoundCue::Selection);
    Expect(backend.played.size() == 1, "Aucun son ne doit etre joue en mode muet");
    service.SetBackground(domain::AudioBackground::Tavern);
    Expect(!backend.loops.back().first.has_value(), "L'ambiance doit etre arretee en mode muet");

    service.ShutdownImmediately();
    service.Play(domain::SoundCue::Navigation);
    Expect(backend.interruptCount == 1 && backend.shutdownCount == 1,
        "Arret immediat et liberation du moteur attendus");
    Expect(backend.played.size() == 1, "Aucune lecture ne doit suivre l'arret audio");

    std::cout << "[TEST PASSED] AudioSettingsAndServiceRouting\n";
}
