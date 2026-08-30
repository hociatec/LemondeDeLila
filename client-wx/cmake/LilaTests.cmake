include_guard(GLOBAL)

add_executable(lemonde_de_lila_wx_tests
    tests/NetworkProtocolTests.cpp
    src/modules/catalog/infrastructure/CatalogPayloadCodec.cpp
    src/modules/catalog/presentation/CatalogShelfNavigator.cpp
    src/modules/rooms/infrastructure/RoomPayloadCodec.cpp
    src/modules/rooms/infrastructure/RoomInvitationPayloadCodec.cpp
    src/modules/rooms/infrastructure/TableAmbiencePayloadCodec.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.Commands.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.CommandResponses.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.State.cpp
    src/modules/rooms/presentation/navigation/RoomLobbyNavigator.cpp
    src/modules/rooms/presentation/navigation/RoomOpenRequest.cpp
    src/modules/rooms/presentation/model/RoomPresentationModel.cpp
    src/modules/rooms/presentation/shortcuts/RoomShortcutPolicy.cpp
    src/modules/vault/infrastructure/VaultPayloadCodec.cpp
    src/modules/vault/presentation/VaultNavigator.cpp
    src/modules/vault/presentation/VaultPresentationModel.cpp
    src/modules/storybook/infrastructure/StoryBookPayloadCodec.cpp
    src/modules/storybook/presentation/StoryBookNavigator.cpp
    src/modules/leaderboard/infrastructure/LeaderboardPayloadCodec.cpp
    src/modules/leaderboard/presentation/LeaderboardNavigator.cpp
    src/modules/chat/application/ChatMessageStore.cpp
    src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatEventPayloadParser.cpp
    src/modules/chat/infrastructure/ChatCommandPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatProtocol.cpp
    src/modules/options/application/OptionsStore.cpp
    src/modules/options/infrastructure/OptionsJsonDocumentCodec.cpp
    src/modules/options/infrastructure/OptionsJsonSchemaMigrator.cpp
    src/modules/options/infrastructure/OptionsStateJsonMapper.cpp
    src/modules/session/application/SessionStore.cpp
    src/modules/session/application/SessionStore.Refresh.cpp
    src/modules/session/application/SessionStore.Revocation.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/accessibility/presentation/ActionButton.cpp
    src/shared/accessibility/application/NavigationController.cpp
    src/shared/accessibility/application/NavigationScope.cpp
    src/shared/accessibility/application/NavigationBindings.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/modules/audio/application/AudioService.cpp
    src/modules/audio/application/SoundVolumeResolver.cpp
    src/modules/audio/infrastructure/LocalSoundManifest.cpp
    src/modules/audio/presentation/SoundOptionsCatalog.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/config/infrastructure/AppDataPaths.cpp
    src/shared/network/infrastructure/http/WsTicketProvider.cpp
    src/shared/network/infrastructure/http/WsTicketTransport.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
    src/shared/security/infrastructure/SecurityUtils.cpp
    src/shared/security/domain/JwtPayload.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/logging/infrastructure/Logger.cpp
    src/shared/persistence/infrastructure/JsonFileStorage.cpp
)

target_include_directories(lemonde_de_lila_wx_tests PRIVATE
    src
    ${CMAKE_CURRENT_BINARY_DIR}/generated
)

target_link_libraries(lemonde_de_lila_wx_tests PRIVATE
    nlohmann_json::nlohmann_json
    wx::core
    wx::base
)

if(WIN32)
    target_link_libraries(lemonde_de_lila_wx_tests PRIVATE
        crypt32
        winhttp
    )
endif()

lila_configure_cpp_target(lemonde_de_lila_wx_tests)

add_test(
    NAME lemonde_de_lila_wx_tests
    COMMAND lemonde_de_lila_wx_tests
)

lila_add_test_executable(lemonde_de_lila_wx_update_tests
    tests/UpdateProtocolTests.cpp
    src/modules/update/domain/UpdateProtocol.cpp
)
target_link_libraries(lemonde_de_lila_wx_update_tests PRIVATE nlohmann_json::nlohmann_json)

lila_add_test_executable(lemonde_de_lila_wx_update_trust_tests
    tests/UpdateTrustPolicyTests.cpp
    src/modules/update/domain/UpdateTrustPolicy.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_async_audio_tests
    tests/AsyncAudioBackendTests.cpp
    src/modules/audio/infrastructure/AsyncAudioBackend.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_url_utils_tests
    tests/UrlUtilsTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_background_executor_tests
    tests/BackgroundExecutorTests.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/logging/infrastructure/Logger.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_service_resilience_tests
    tests/ServiceResilienceTests.cpp
    src/modules/chat/application/ChatService.cpp
    src/modules/chat/application/ChatService.Connection.cpp
    src/modules/chat/application/ChatService.Messages.cpp
    src/modules/chat/application/ChatService.Reconnect.cpp
    src/modules/chat/application/ChatMessageStore.cpp
    src/modules/options/application/OptionsStore.cpp
    src/modules/rooms/application/RoomSessionService.cpp
    src/modules/rooms/application/RoomSessionService.Realtime.cpp
    src/modules/session/application/SessionStore.cpp
    src/modules/session/application/SessionStore.Refresh.cpp
    src/modules/session/application/SessionStore.Revocation.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/logging/infrastructure/Logger.cpp
    src/shared/security/domain/JwtPayload.cpp
    src/shared/security/infrastructure/SecurityUtils.cpp
)
target_link_libraries(
    lemonde_de_lila_wx_service_resilience_tests
    PRIVATE nlohmann_json::nlohmann_json
)
if(WIN32)
    target_link_libraries(lemonde_de_lila_wx_service_resilience_tests PRIVATE crypt32)
endif()
lila_add_test_executable(lemonde_de_lila_wx_social_data_store_tests
    tests/SocialDataStoreTests.cpp
    src/modules/social/presentation/SocialDataStore.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_messaging_selection_tests
    tests/MessagingSelectionMemoryTests.cpp
    src/modules/messaging/presentation/MessagingSelectionMemory.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_navigation_state_tests
    tests/NavigationStateTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_social_profile_mapper_tests
    tests/SocialProfileMapperTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_chat_error_resolver_tests
    tests/ChatErrorResolverTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_realtime_deadline_tests
    tests/RealtimeRequestDeadlineTests.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
)
target_link_libraries(
    lemonde_de_lila_wx_realtime_deadline_tests
    PRIVATE nlohmann_json::nlohmann_json
)

add_library(lemonde_de_lila_wx_presentation_compile_tests OBJECT
    tests/PresentationControllerCompileTests.cpp
    src/modules/messaging/presentation/MessagingActionController.cpp
)
target_include_directories(lemonde_de_lila_wx_presentation_compile_tests PRIVATE src)
lila_configure_cpp_target(lemonde_de_lila_wx_presentation_compile_tests)

add_executable(lemonde_de_lila_wx_gameplay_tests
    tests/GameplayContractTests.cpp
    src/modules/gameplay/actions/application/GameActionPresentationPolicy.cpp
    src/modules/gameplay/cards/application/GameCardActionResolver.cpp
    src/modules/gameplay/cards/application/GameCardTextBuilder.cpp
    src/modules/gameplay/cards/infrastructure/GameCardDecoder.cpp
    src/modules/gameplay/dice/application/GameDiceActionResolver.cpp
    src/modules/gameplay/dice/application/GameDiceTextBuilder.cpp
    src/modules/gameplay/dice/infrastructure/GameDiceDecoder.cpp
    src/modules/gameplay/prompts/application/GamePromptInputCodec.cpp
    src/modules/gameplay/prompts/application/GameActionPromptFactory.cpp
    src/modules/gameplay/history/presentation/GameLogCursor.cpp
    src/modules/gameplay/information/application/GameCapabilityTextBuilder.cpp
    src/modules/gameplay/session/infrastructure/GameEventPayloadCodec.cpp
    src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp
    src/modules/gameplay/state/infrastructure/GamePendingDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStateSectionsDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStatePayloadCodec.cpp
    src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp
    src/modules/gameplay/state/domain/GameKits.cpp
    src/modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.cpp
)
target_include_directories(lemonde_de_lila_wx_gameplay_tests PRIVATE src)
target_link_libraries(lemonde_de_lila_wx_gameplay_tests PRIVATE nlohmann_json::nlohmann_json)
lila_configure_cpp_target(lemonde_de_lila_wx_gameplay_tests)
add_test(
    NAME lemonde_de_lila_wx_gameplay_tests
    COMMAND lemonde_de_lila_wx_gameplay_tests
)

add_executable(lemonde_de_lila_wx_parser_robustness_tests
    tests/ParserRobustnessTests.cpp
    src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatEventPayloadParser.cpp
    src/modules/chat/infrastructure/ChatCommandPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatProtocol.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/logging/infrastructure/Logger.cpp
)

target_include_directories(lemonde_de_lila_wx_parser_robustness_tests PRIVATE
    src
    ${CMAKE_CURRENT_BINARY_DIR}/generated
)

target_link_libraries(lemonde_de_lila_wx_parser_robustness_tests PRIVATE
    nlohmann_json::nlohmann_json
    wx::core
    wx::base
)
lila_configure_cpp_target(lemonde_de_lila_wx_parser_robustness_tests)
add_test(
    NAME lemonde_de_lila_wx_parser_robustness_tests
    COMMAND lemonde_de_lila_wx_parser_robustness_tests
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/data/parser-robustness-corpus.txt"
)
