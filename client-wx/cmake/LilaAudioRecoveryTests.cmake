if(WIN32)
    lila_add_test_executable(lemonde_de_lila_wx_sound_asset_recovery_tests
        tests/SoundAssetRecoveryTests.cpp
        src/modules/audio/infrastructure/SoundAssetPath.cpp
        src/modules/audio/infrastructure/SoundAssetManifest.cpp
        src/modules/audio/infrastructure/SoundAssetCacheCleanup.cpp
        src/modules/audio/infrastructure/LocalSoundManifest.cpp
        src/modules/audio/domain/SoundCatalog.cpp
        src/shared/logging/infrastructure/Logger.cpp)
    target_link_libraries(lemonde_de_lila_wx_sound_asset_recovery_tests PRIVATE
        bcrypt nlohmann_json::nlohmann_json)
    lila_add_test_executable(lemonde_de_lila_wx_http_cancellation_tests
        tests/HttpCancellationTests.cpp
        src/shared/network/infrastructure/http/WsTicketTransport.cpp
        src/shared/logging/infrastructure/Logger.cpp)
    target_link_libraries(lemonde_de_lila_wx_http_cancellation_tests PRIVATE
        winhttp ws2_32 nlohmann_json::nlohmann_json)
    set_tests_properties(lemonde_de_lila_wx_http_cancellation_tests PROPERTIES TIMEOUT 15)
endif()
