include_guard(GLOBAL)
include(${CMAKE_CURRENT_LIST_DIR}/LilaAdminQuizTests.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/LilaAudioRecoveryTests.cmake)

find_program(LILA_CLIENT_ARCHITECTURE_NODE_EXECUTABLE node REQUIRED)
add_test(
    NAME lemonde_de_lila_wx_architecture_tests
    COMMAND "${LILA_CLIENT_ARCHITECTURE_NODE_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/scripts/VerifyClientArchitecture.mjs"
)

if(WIN32)
    lila_add_test_executable(lemonde_de_lila_wx_bass_unavailable_tests
        tests/BassUnavailableTests.cpp
        src/modules/audio/infrastructure/BassApi.cpp
        src/modules/audio/infrastructure/BassAudioBackend.cpp
        src/modules/audio/infrastructure/BassAudioBackend.Assets.cpp
        src/modules/audio/infrastructure/BassSampleCache.cpp
        src/modules/audio/infrastructure/BassStreamCache.cpp
        src/modules/audio/infrastructure/LocalSoundManifest.cpp
        src/modules/audio/infrastructure/SoundAssetCacheCleanup.cpp
        src/modules/audio/infrastructure/SoundAssetManifest.cpp
        src/modules/audio/infrastructure/SoundAssetPath.cpp
        src/modules/audio/domain/SoundCatalog.cpp
        src/shared/logging/infrastructure/Logger.cpp
    )
    target_include_directories(lemonde_de_lila_wx_bass_unavailable_tests PRIVATE "${LILA_BASS_ROOT}/include")
    target_compile_definitions(lemonde_de_lila_wx_bass_unavailable_tests PRIVATE
        LILA_DISABLE_REMOTE_SOUND_ASSETS=1
    )
    target_link_libraries(lemonde_de_lila_wx_bass_unavailable_tests PRIVATE nlohmann_json::nlohmann_json)

    lila_add_test_executable(lemonde_de_lila_wx_bass_cache_tests
        tests/BassCacheTests.cpp
        tests/audio/FakeBassApi.cpp
        src/modules/audio/infrastructure/BassSampleCache.cpp
        src/modules/audio/infrastructure/BassStreamCache.cpp
    )
    target_include_directories(lemonde_de_lila_wx_bass_cache_tests PRIVATE "${LILA_BASS_ROOT}/include")
endif()

lila_add_test_executable(lemonde_de_lila_wx_audio_regression_tests
    tests/AudioRegressionTests.cpp
    src/modules/audio/application/AudioService.cpp
    src/modules/audio/application/SoundVolumeResolver.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/modules/audio/infrastructure/NotificationAudioDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameValueDecoder.cpp
    src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp
    src/modules/chat/application/ChatMessageStore.cpp
)
target_link_libraries(lemonde_de_lila_wx_audio_regression_tests PRIVATE nlohmann_json::nlohmann_json)
add_dependencies(lemonde_de_lila_wx_audio_regression_tests generate_protocol_contracts)

lila_add_test_executable(lemonde_de_lila_wx_sound_asset_manifest_tests
    tests/SoundAssetManifestTests.cpp
    src/modules/audio/infrastructure/SoundAssetManifest.cpp
)
target_link_libraries(lemonde_de_lila_wx_sound_asset_manifest_tests PRIVATE nlohmann_json::nlohmann_json)

lila_add_test_executable(lemonde_de_lila_wx_missing_audio_assets_tests
    tests/MissingAudioAssetsTests.cpp
    src/modules/audio/infrastructure/LocalSoundManifest.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_game_sound_tests
    tests/GameSoundPolicyTests.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/modules/audio/application/SoundVolumeResolver.cpp
    src/modules/audio/presentation/SoundOptionsCatalog.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_logger_sanitization_tests
    tests/LoggerSanitizationTests.cpp
    src/shared/logging/infrastructure/Logger.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_presence_presentation_tests
    tests/PresencePresentationModelTests.cpp
    src/modules/presence/presentation/PresencePresentationModel.cpp
    src/shared/logging/infrastructure/Logger.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
)
target_link_libraries(
    lemonde_de_lila_wx_presence_presentation_tests
    PRIVATE ${wxWidgets_LIBRARIES} nlohmann_json::nlohmann_json
)

add_executable(lemonde_de_lila_wx_tests
    tests/NetworkProtocolTests.cpp
    src/modules/catalog/infrastructure/CatalogApi.cpp
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
    src/modules/rooms/presentation/lobby/RoomLobbyPresentationModel.cpp
    src/modules/rooms/presentation/model/RoomPresentationModel.cpp
    src/modules/rooms/presentation/actions/RoomActionPolicy.cpp
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
    src/modules/options/infrastructure/OptionsStateJsonMapper.cpp
    src/modules/session/application/SessionStore.cpp
    src/modules/session/application/SessionStore.Refresh.cpp
    src/modules/session/application/SessionStore.Revocation.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/accessibility/presentation/ActionButton.cpp
    src/shared/accessibility/presentation/NavigationController.cpp
    src/shared/accessibility/presentation/NavigationScope.cpp
    src/shared/accessibility/presentation/NavigationBindings.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/modules/audio/application/AudioService.cpp
    src/modules/audio/application/SoundVolumeResolver.cpp
    src/modules/audio/infrastructure/LocalSoundManifest.cpp
    src/modules/audio/presentation/SoundOptionsCatalog.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/config/infrastructure/AppDataPaths.cpp
    src/shared/network/infrastructure/http/WsTicketProvider.cpp
    src/shared/network/infrastructure/http/WsTicketTransport.cpp
    src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
    src/shared/network/application/realtime/ReconnectPolicy.cpp
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
target_compile_options(lemonde_de_lila_wx_tests PRIVATE $<$<CXX_COMPILER_ID:MSVC>:/UNDEBUG> $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-UNDEBUG>)

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

lila_add_test_executable(lemonde_de_lila_wx_update_retry_policy_tests
    tests/UpdateRetryPolicyTests.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_update_recovery_tests
    tests/UpdateRecoveryTests.cpp
    src/modules/update/domain/UpdateInstallationState.cpp
    src/modules/update/domain/UpdateProtocol.cpp
    src/modules/update/infrastructure/launcher/UpdateStagingCleanup.cpp
)
target_link_libraries(lemonde_de_lila_wx_update_recovery_tests PRIVATE nlohmann_json::nlohmann_json)

lila_add_test_executable(lemonde_de_lila_wx_session_persistence_policy_tests
    tests/SessionPersistencePolicyTests.cpp
    src/modules/session/infrastructure/SessionStorageMigration.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_async_audio_tests
    tests/AsyncAudioBackendTests.cpp
    src/modules/audio/infrastructure/AsyncAudioBackend.cpp
    src/shared/logging/infrastructure/Logger.cpp
)

lila_add_test_executable(lemonde_de_lila_wx_url_utils_tests
    tests/UrlUtilsTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_websocket_policy_tests
    tests/WebSocketPolicyTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_websocket_operation_gate_tests
    tests/WebSocketOperationGateTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_game_event_mailbox_tests
    tests/GameEventMailboxTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_focus_memory_lifecycle_tests
    tests/FocusMemoryLifecycleTests.cpp
    src/shared/accessibility/presentation/FocusMemory.cpp
    src/shared/accessibility/presentation/FocusCoordinator.cpp
    src/shared/accessibility/presentation/FocusManager.cpp
    src/shared/accessibility/presentation/NavigationController.cpp
    src/shared/accessibility/presentation/NavigationScope.cpp
)
target_link_libraries(lemonde_de_lila_wx_focus_memory_lifecycle_tests PRIVATE ${wxWidgets_LIBRARIES})
lila_add_test_executable(lemonde_de_lila_wx_accessibility_announcement_tests
    tests/AccessibilityAnnouncementTests.cpp
    src/modules/chat/presentation/ChatEventBinder.cpp
    src/shared/accessibility/presentation/AccessibilityUtils.cpp
    src/shared/accessibility/presentation/AccessibleListBox.cpp
    src/shared/accessibility/presentation/AccessibleListBox.Actions.cpp
    src/shared/accessibility/presentation/ActivationFocusContext.cpp
    src/shared/accessibility/presentation/NavigationController.cpp
    src/shared/accessibility/presentation/NavigationScope.cpp
    src/shared/accessibility/presentation/NavigationBindings.cpp
    src/shared/ui/presentation/controls/VerticalMenu.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Layout.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Events.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Navigation.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Entries.cpp
    src/shared/ui/presentation/controls/VerticalMenuEntry.cpp
    src/shared/ui/presentation/theme/Theme.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/logging/infrastructure/Logger.cpp
)
target_link_libraries(lemonde_de_lila_wx_accessibility_announcement_tests
    PRIVATE ${wxWidgets_LIBRARIES} nlohmann_json::nlohmann_json)
if(WIN32)
    target_sources(lemonde_de_lila_wx_accessibility_announcement_tests PRIVATE tests/WindowsGuiTests.rc)
    target_sources(lemonde_de_lila_wx_focus_memory_lifecycle_tests PRIVATE tests/WindowsGuiTests.rc)
endif()
lila_add_test_executable(lemonde_de_lila_wx_background_task_lifecycle_tests
    tests/BackgroundTaskLifecycleTests.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/logging/infrastructure/Logger.cpp
)
target_link_libraries(lemonde_de_lila_wx_background_task_lifecycle_tests PRIVATE ${wxWidgets_LIBRARIES})
if(WIN32)
    target_sources(lemonde_de_lila_wx_background_task_lifecycle_tests PRIVATE tests/WindowsGuiTests.rc)
endif()
lila_add_test_executable(lemonde_de_lila_wx_background_executor_tests
    tests/BackgroundExecutorTests.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/logging/infrastructure/Logger.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_reconnect_policy_tests
    tests/ReconnectPolicyTests.cpp
    src/shared/network/application/realtime/ReconnectPolicy.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_gameplay_lifecycle_tests
    tests/GamePlayLifecycleTests.cpp
    src/modules/gameplay/shell/application/GamePlayLifecycle.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_game_event_identity_tests
    tests/GameEventIdentityWindowTests.cpp
    src/modules/gameplay/events/application/GameEventIdentityWindow.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_service_resilience_tests
    tests/ServiceResilienceTests.cpp
    src/modules/presence/application/PresenceMonitor.cpp
    src/modules/presence/application/PresenceMonitor.Activity.cpp
    src/modules/presence/infrastructure/PresencePayloadCodec.cpp
    src/modules/rooms/application/RoomInvitationMonitor.cpp
    src/modules/rooms/infrastructure/RoomInvitationPayloadCodec.cpp
    src/modules/chat/application/ChatService.cpp
    src/modules/chat/application/ChatService.Connection.cpp
    src/modules/chat/application/ChatService.Heartbeat.cpp
    src/modules/chat/application/ChatService.Messages.cpp
    src/modules/chat/application/ChatService.Reconnect.cpp
    src/modules/chat/application/ChatMessageStore.cpp
    src/modules/gameplay/session/application/GameSessionService.cpp
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
    src/shared/network/application/realtime/ReconnectPolicy.cpp
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
    src/modules/social/presentation/SocialSelectionMemory.cpp
    src/modules/admin/domain/AdminArea.cpp
    src/modules/main_menu/presentation/MainMenuContent.cpp
    src/modules/admin/domain/AdminCommandCatalog.cpp
    src/modules/admin/domain/AdminCommandCatalog.Moderation.cpp
    src/modules/admin/domain/AdminCommandCatalog.Content.cpp
    src/modules/admin/domain/AdminCommandCatalog.Operations.cpp
    src/shared/security/infrastructure/SecurityUtils.cpp
)
if(WIN32)
    target_link_libraries(lemonde_de_lila_wx_navigation_state_tests PRIVATE crypt32)
endif()
lila_add_test_executable(lemonde_de_lila_wx_admin_contract_tests
    tests/AdminContractTests.cpp
    src/modules/admin/domain/AdminCommandCatalog.cpp
    src/modules/admin/domain/AdminCommandCatalog.Moderation.cpp
    src/modules/admin/domain/AdminCommandCatalog.Content.cpp
    src/modules/admin/domain/AdminCommandCatalog.Operations.cpp
    src/modules/admin/domain/AdminFormMetadata.cpp
    src/modules/admin/domain/AdminFormMetadata.BugReports.cpp
    src/modules/admin/infrastructure/AdminPayloadValidator.cpp
    src/modules/admin/presentation/AdminBugReportListFormatter.cpp
    src/modules/admin/presentation/AdminResultFormatter.cpp
    src/modules/admin/presentation/AdminMnemoQuestionFormatter.cpp
    src/shared/network/infrastructure/http/AuthenticatedHttpClient.cpp
)
target_link_libraries(
    lemonde_de_lila_wx_admin_contract_tests
    PRIVATE nlohmann_json::nlohmann_json
)
if(WIN32)
    target_sources(lemonde_de_lila_wx_admin_contract_tests PRIVATE
        src/shared/text/presentation/encoding/Encoding.cpp
        src/shared/text/presentation/catalog/UiTextCatalog.cpp
        src/shared/logging/infrastructure/Logger.cpp
    )
    target_link_libraries(lemonde_de_lila_wx_admin_contract_tests PRIVATE winhttp wx::base)
endif()
if(EXISTS "${LILA_BACKEND_ROOT}")
    find_program(LILA_ADMIN_COVERAGE_NODE_EXECUTABLE node REQUIRED)
    add_test(
        NAME lemonde_de_lila_wx_admin_backend_coverage_tests
        COMMAND "${LILA_ADMIN_COVERAGE_NODE_EXECUTABLE}"
            "${CMAKE_CURRENT_SOURCE_DIR}/scripts/VerifyAdminClientCoverage.mjs"
            --backend-root "${LILA_BACKEND_ROOT}"
            --client-root "${CMAKE_CURRENT_SOURCE_DIR}"
    )
endif()
lila_add_test_executable(lemonde_de_lila_wx_social_profile_mapper_tests
    tests/SocialProfileMapperTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_chat_error_resolver_tests
    tests/ChatErrorResolverTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_grid_accessibility_text_tests
    tests/GameGridAccessibilityTextTests.cpp
)
lila_add_test_executable(lemonde_de_lila_wx_realtime_deadline_tests
    tests/RealtimeRequestDeadlineTests.cpp
    src/shared/config/domain/AppConfig.cpp
    src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
    src/shared/network/application/realtime/ReconnectPolicy.cpp
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
    src/modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.cpp
    src/modules/gameplay/cards/application/GameCardActionResolver.cpp
    src/modules/gameplay/cards/application/GameCardTextBuilder.cpp
    src/modules/gameplay/cards/infrastructure/GameCardDecoder.cpp
    src/modules/gameplay/dice/application/GameDiceActionResolver.cpp
    src/modules/gameplay/dice/application/GameDiceTextBuilder.cpp
    src/modules/gameplay/dice/infrastructure/GameDiceDecoder.cpp
    src/modules/gameplay/prompts/application/GamePromptInputCodec.cpp
    src/modules/gameplay/prompts/application/GameActionPromptFactory.cpp
    src/modules/gameplay/state/application/GameValuePayloadCodec.cpp
    src/modules/gameplay/history/presentation/GameLogCursor.cpp
    src/modules/gameplay/grid/application/GameGridActionResolver.cpp
    src/modules/gameplay/workflows/application/GameQuizActionResolver.cpp
    src/modules/gameplay/events/presentation/GameEventPresenter.cpp
    src/modules/gameplay/information/application/GameAssetCapabilityText.cpp
    src/modules/gameplay/information/application/GameBoardCapabilityText.cpp
    src/modules/gameplay/information/application/GameCapabilityTextBuilder.cpp
    src/modules/gameplay/information/application/GameValueCapabilityText.cpp
    src/modules/gameplay/information/application/GameValueTextBuilder.cpp
    src/modules/gameplay/information/application/GameWorkflowCapabilityText.cpp
    src/modules/gameplay/session/infrastructure/GameCommandPayloadCodec.cpp
    src/modules/gameplay/session/infrastructure/GameEventPayloadCodec.cpp
    src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp
    src/modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GamePendingDecoder.cpp
    src/modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStateSectionsDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStatePayloadCodec.cpp
    src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameValueDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.cpp
    src/modules/gameplay/state/domain/GameKits.cpp
    src/modules/gameplay/state/domain/GameSystem.cpp
)
target_compile_definitions(
    lemonde_de_lila_wx_gameplay_tests
    PRIVATE LILA_CLIENT_SOURCE_DIR="${CMAKE_CURRENT_SOURCE_DIR}"
)
target_include_directories(lemonde_de_lila_wx_gameplay_tests PRIVATE src)
target_link_libraries(lemonde_de_lila_wx_gameplay_tests PRIVATE nlohmann_json::nlohmann_json)
lila_configure_cpp_target(lemonde_de_lila_wx_gameplay_tests)
target_compile_options(lemonde_de_lila_wx_gameplay_tests PRIVATE $<$<CXX_COMPILER_ID:MSVC>:/UNDEBUG> $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-UNDEBUG>)
add_test(
    NAME lemonde_de_lila_wx_gameplay_tests
    COMMAND lemonde_de_lila_wx_gameplay_tests
)

add_executable(lemonde_de_lila_wx_parser_robustness_tests
    tests/ParserRobustnessTests.cpp
    src/modules/catalog/infrastructure/CatalogPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatEventPayloadParser.cpp
    src/modules/chat/infrastructure/ChatCommandPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatProtocol.cpp
    src/modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.cpp
    src/modules/gameplay/cards/infrastructure/GameCardDecoder.cpp
    src/modules/gameplay/dice/infrastructure/GameDiceDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GamePayloadJsonReader.cpp
    src/modules/gameplay/state/infrastructure/GamePendingDecoder.cpp
    src/modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStateSectionsDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameStatePayloadCodec.cpp
    src/modules/gameplay/state/infrastructure/GameSystemDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameValueDecoder.cpp
    src/modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.cpp
    src/modules/gameplay/state/domain/GameKits.cpp
    src/modules/gameplay/state/domain/GameSystem.cpp
    src/modules/messaging/infrastructure/MessagingPayloadCodec.cpp
    src/modules/presence/infrastructure/PresencePayloadCodec.cpp
    src/modules/rooms/infrastructure/RoomPayloadCodec.cpp
    src/modules/social/infrastructure/SocialPayloadCodec.cpp
    src/modules/storybook/infrastructure/StoryBookPayloadCodec.cpp
    src/modules/vault/infrastructure/VaultPayloadCodec.cpp
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
target_compile_options(lemonde_de_lila_wx_parser_robustness_tests PRIVATE $<$<CXX_COMPILER_ID:MSVC>:/UNDEBUG> $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-UNDEBUG>)
add_test(
    NAME lemonde_de_lila_wx_parser_robustness_tests
    COMMAND lemonde_de_lila_wx_parser_robustness_tests
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/data/parser-robustness-corpus.txt"
)
