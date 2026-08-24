cmake_minimum_required(VERSION 3.28)

set(LILA_PROJECT_VERSION "1.2.651.0" CACHE STRING "Version à quatre composants du client WX")
project(lemonde_de_lila_wx VERSION ${LILA_PROJECT_VERSION} LANGUAGES CXX)

set(LILA_UPDATE_PUBLIC_KEY_DER_BASE64 "" CACHE STRING "Clé publique RSA DER/base64 des manifestes de mise à jour")
set(LILA_UPDATE_MANIFEST_URL "https://api.lilas.hociatec.fr/api/client/releases/latest?platform=windows&arch=x64" CACHE STRING "URL du manifeste de mise à jour WX")

include(CTest)

option(LILA_ENABLE_ASAN "Enable AddressSanitizer where supported" OFF)
option(LILA_ENABLE_UBSAN "Enable UndefinedBehaviorSanitizer where supported" OFF)
option(LILA_ENABLE_TSAN "Enable ThreadSanitizer where supported" OFF)
option(LILA_ENABLE_CLANG_TIDY "Enable clang-tidy during compilation" OFF)
option(LILA_ENABLE_CPPCHECK "Enable cppcheck during compilation" OFF)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(LILA_ENABLE_CLANG_TIDY)
    find_program(LILA_CLANG_TIDY_EXE NAMES clang-tidy)
    if(LILA_CLANG_TIDY_EXE)
        set(CMAKE_CXX_CLANG_TIDY "${LILA_CLANG_TIDY_EXE}")
    else()
        message(WARNING "LILA_ENABLE_CLANG_TIDY=ON mais clang-tidy est introuvable.")
    endif()
endif()

if(LILA_ENABLE_CPPCHECK)
    find_program(LILA_CPPCHECK_EXE NAMES cppcheck)
    if(LILA_CPPCHECK_EXE)
        set(CMAKE_CXX_CPPCHECK "${LILA_CPPCHECK_EXE};--enable=warning,style,performance,portability;--std=c++20;--inline-suppr")
    else()
        message(WARNING "LILA_ENABLE_CPPCHECK=ON mais cppcheck est introuvable.")
    endif()
endif()

find_package(wxWidgets CONFIG REQUIRED COMPONENTS core base)
find_package(nlohmann_json CONFIG REQUIRED)

configure_file(
    src/shared/config/generated/AppBuildInfo.h.in
    ${CMAKE_CURRENT_BINARY_DIR}/generated/AppBuildInfo.h
    @ONLY
)
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/src/modules/update/infrastructure/config/UpdateBuildConfig.h.in
    ${CMAKE_CURRENT_BINARY_DIR}/generated/UpdateBuildConfig.h
    @ONLY
)

configure_file(
    resources/texts.fr.json
    ${CMAKE_CURRENT_BINARY_DIR}/resources/texts.fr.json
    COPYONLY
)

file(COPY resources/sounds DESTINATION ${CMAKE_CURRENT_BINARY_DIR}/resources)

if(WIN32)
    set(LILA_BASS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/bass")
    configure_file(
        "${LILA_BASS_ROOT}/bin/x64/bass.dll"
        "${CMAKE_CURRENT_BINARY_DIR}/bass.dll"
        COPYONLY
    )
endif()

set(
    LILA_PROTOCOL_CONTRACTS_SCRIPT
    "${CMAKE_CURRENT_SOURCE_DIR}/scripts/GenerateProtocolContracts.ps1"
)

set(
    LILA_BACKEND_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../backend"
    CACHE PATH
    "Racine locale du backend utilisee pour regenerer les contrats protocole"
)

set(
    LILA_BACKEND_WS_EVENTS_FILE
    "${LILA_BACKEND_ROOT}/src/realtime/infrastructure/presentation/ws/ws-events.ts"
)

set(
    LILA_GENERATED_PROTOCOL_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/WsMessageTypes.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/UserAuthFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/SocialProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/ChatProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/MessagingProtocolFields.generated.h"
)

set(
    LILA_PROTOCOL_GENERATION_DEPENDENCIES
    "${LILA_BACKEND_WS_EVENTS_FILE}"
    "${LILA_BACKEND_ROOT}/contracts/client-wx-fields.json"
)

if(EXISTS "${LILA_BACKEND_ROOT}")
    foreach(protocol_dependency IN LISTS LILA_PROTOCOL_GENERATION_DEPENDENCIES)
        if(NOT EXISTS "${protocol_dependency}")
            message(FATAL_ERROR "Contrat backend requis absent: ${protocol_dependency}")
        endif()
    endforeach()
    if(NOT EXISTS "${LILA_PROTOCOL_CONTRACTS_SCRIPT}")
        message(FATAL_ERROR "Generateur de contrats absent: ${LILA_PROTOCOL_CONTRACTS_SCRIPT}")
    endif()

    add_custom_command(
        OUTPUT ${LILA_GENERATED_PROTOCOL_HEADERS}
        COMMAND powershell
            -ExecutionPolicy Bypass
            -File "${LILA_PROTOCOL_CONTRACTS_SCRIPT}"
            -BackendRoot "${LILA_BACKEND_ROOT}"
            -OutputRoot "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol"
        DEPENDS
            "${LILA_PROTOCOL_CONTRACTS_SCRIPT}"
            ${LILA_PROTOCOL_GENERATION_DEPENDENCIES}
        VERBATIM
    )

    add_custom_target(generate_protocol_contracts DEPENDS ${LILA_GENERATED_PROTOCOL_HEADERS})
    message(STATUS "Backend local detecte : generation stricte des contrats protocole activee.")
else()
    add_custom_target(generate_protocol_contracts)
    message(STATUS "Backend local introuvable : utilisation des contrats protocole versionnes dans le client.")
endif()

add_executable(lemonde_de_lila_wx WIN32
    src/app/entrypoint/main.cpp
    src/app/lifecycle/infrastructure/StartupGuard.cpp
    src/app/lifecycle/presentation/Application.cpp
    src/app/navigation/presentation/AppNavigator.cpp
    src/app/navigation/presentation/AppNavigator.GameViews.cpp
    src/app/navigation/presentation/AppNavigator.Games.cpp
    src/app/navigation/presentation/AppNavigator.Session.cpp
    src/app/navigation/presentation/AppNavigator.Social.cpp
    src/app/navigation/presentation/AppNavigator.SocialViews.cpp
    src/app/navigation/presentation/AppNavigator.Transitions.cpp
    src/app/navigation/presentation/AppNavigator.ViewFactory.cpp
    src/app/navigation/presentation/HostFrame.cpp
    src/bootstrap/composition/infrastructure/audio/AudioComposition.cpp
    src/bootstrap/composition/infrastructure/game/GameComposition.cpp
    src/bootstrap/composition/infrastructure/network/NetworkComposition.cpp
    src/bootstrap/composition/infrastructure/social/SocialComposition.cpp
    src/bootstrap/composition/infrastructure/support/AuthenticatedServiceFactory.cpp
    src/bootstrap/composition/infrastructure/user/UserComposition.cpp
    src/bootstrap/lifecycle/application/AppBootstrap.cpp
    src/bootstrap/runtime/application/AppRuntime.cpp

    src/modules/about/presentation/AboutFrame.cpp
    src/modules/about/presentation/AboutFrame.Events.cpp
    src/modules/about/presentation/AboutFrame.Layout.cpp
    src/modules/about/presentation/AboutPageContentBuilder.cpp
    src/modules/about/presentation/AboutPageCoordinator.cpp

    src/modules/catalog/application/CatalogService.cpp
    src/modules/catalog/infrastructure/CatalogApi.cpp
    src/modules/catalog/infrastructure/CatalogPayloadCodec.cpp
    src/modules/catalog/presentation/CatalogPanel.cpp
    src/modules/catalog/presentation/CatalogPanel.Events.cpp
    src/modules/catalog/presentation/CatalogPanel.Layout.cpp
    src/modules/catalog/presentation/CatalogPanel.Loading.cpp
    src/modules/catalog/presentation/CatalogShelfNavigator.cpp

    src/modules/rooms/application/RoomLobbyService.cpp
    src/modules/rooms/application/RoomSessionService.cpp
    src/modules/rooms/application/RoomSessionService.Realtime.cpp
    src/modules/rooms/infrastructure/RoomLobbyApi.cpp
    src/modules/rooms/infrastructure/RoomPayloadCodec.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.Commands.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.CommandResponses.cpp
    src/modules/rooms/infrastructure/RoomSessionGateway.State.cpp
    src/modules/rooms/presentation/JoinRoomsPanel.cpp
    src/modules/rooms/presentation/JoinRoomsPanel.Events.cpp
    src/modules/rooms/presentation/JoinRoomsPanel.Layout.cpp
    src/modules/rooms/presentation/JoinRoomsPanel.Loading.cpp
    src/modules/rooms/presentation/JoinRoomsPanel.Pages.cpp
    src/modules/rooms/presentation/RoomLobbyNavigator.cpp
    src/modules/rooms/presentation/RoomLobbyPresentationModel.cpp
    src/modules/rooms/presentation/RoomOpenRequest.cpp
    src/modules/rooms/presentation/RoomGameZoneAnchor.cpp
    src/modules/rooms/presentation/RoomPanel.cpp
    src/modules/rooms/presentation/RoomPanel.Actions.cpp
    src/modules/rooms/presentation/RoomPanel.Commands.cpp
    src/modules/rooms/presentation/RoomPanel.Confirmation.cpp
    src/modules/rooms/presentation/RoomPanel.Events.cpp
    src/modules/rooms/presentation/RoomPanel.Layout.cpp
    src/modules/rooms/presentation/RoomPanel.Loading.cpp
    src/modules/rooms/presentation/RoomPanel.Preparation.cpp
    src/modules/rooms/presentation/RoomPanel.Realtime.cpp
    src/modules/rooms/presentation/RoomPanel.Shortcuts.cpp
    src/modules/rooms/presentation/RoomPanel.State.cpp
    src/modules/rooms/presentation/RoomPresentationModel.cpp
    src/modules/rooms/presentation/RoomShortcutPolicy.cpp

    src/modules/vault/application/VaultService.cpp
    src/modules/vault/infrastructure/VaultApi.cpp
    src/modules/vault/infrastructure/VaultPayloadCodec.cpp
    src/modules/vault/presentation/VaultNavigator.cpp
    src/modules/vault/presentation/VaultPresentationModel.cpp
    src/modules/vault/presentation/VaultPanel.cpp
    src/modules/vault/presentation/VaultPanel.Actions.cpp
    src/modules/vault/presentation/VaultPanel.Events.cpp
    src/modules/vault/presentation/VaultPanel.Layout.cpp
    src/modules/vault/presentation/VaultPanel.Loading.cpp
    src/modules/vault/presentation/VaultPanel.Pages.cpp

    src/modules/storybook/application/StoryBookService.cpp
    src/modules/storybook/infrastructure/StoryBookApi.cpp
    src/modules/storybook/infrastructure/StoryBookPayloadCodec.cpp
    src/modules/storybook/presentation/StoryBookNavigator.cpp
    src/modules/storybook/presentation/StoryBookPanel.cpp
    src/modules/storybook/presentation/StoryBookPanel.Events.cpp
    src/modules/storybook/presentation/StoryBookPanel.Layout.cpp
    src/modules/storybook/presentation/StoryBookPanel.Loading.cpp
    src/modules/storybook/presentation/StoryBookPanel.Pages.cpp

    src/modules/leaderboard/application/LeaderboardService.cpp
    src/modules/leaderboard/infrastructure/LeaderboardApi.cpp
    src/modules/leaderboard/infrastructure/LeaderboardPayloadCodec.cpp
    src/modules/leaderboard/presentation/LeaderboardNavigator.cpp
    src/modules/leaderboard/presentation/LeaderboardPanel.cpp
    src/modules/leaderboard/presentation/LeaderboardPanel.Events.cpp
    src/modules/leaderboard/presentation/LeaderboardPanel.Layout.cpp
    src/modules/leaderboard/presentation/LeaderboardPanel.Loading.cpp
    src/modules/leaderboard/presentation/LeaderboardPanel.Pages.cpp

    src/modules/chat/application/ChatService.cpp
    src/modules/chat/application/ChatService.Connection.cpp
    src/modules/chat/application/ChatService.Messages.cpp
    src/modules/chat/application/ChatService.Reconnect.cpp
    src/modules/chat/application/ChatMessageStore.cpp
    src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
    src/modules/chat/infrastructure/ChatProtocol.cpp
    src/modules/chat/infrastructure/PresenceChatGateway.cpp
    src/modules/chat/presentation/ChatEventBinder.cpp
    src/modules/chat/presentation/ChatFrame.cpp
    src/modules/chat/presentation/ChatFrame.Actions.cpp
    src/modules/chat/presentation/ChatFrame.Connection.cpp
    src/modules/chat/presentation/ChatFrame.Layout.cpp
    src/modules/chat/presentation/ChatFrame.Events.cpp
    src/modules/chat/presentation/ChatFocusController.cpp
    src/modules/chat/presentation/ChatFrame.History.cpp

    src/modules/messaging/application/MessagingService.cpp
    src/modules/messaging/infrastructure/MessagingApi.cpp
    src/modules/messaging/infrastructure/MessagingPayloadCodec.cpp
    src/modules/messaging/presentation/MessagingActionController.cpp
    src/modules/messaging/presentation/MessagingComposeController.cpp
    src/modules/messaging/presentation/MessagingEventBinder.cpp
    src/modules/messaging/presentation/MessagingFocusController.cpp
    src/modules/messaging/presentation/MessagingPresentationModel.cpp
    src/modules/messaging/presentation/MessagingSelectionMemory.cpp
    src/modules/messaging/presentation/MessagingMailboxLoader.cpp
    src/modules/messaging/presentation/MessagingView.cpp
    src/modules/messaging/presentation/MessagingView.Menu.cpp
    src/modules/messaging/presentation/MessagingView.Detail.cpp
    src/modules/messaging/presentation/MessagingView.Compose.cpp
    src/modules/messaging/presentation/MessagingView.Theme.cpp
    src/modules/messaging/presentation/MessagingFrame.cpp
    src/modules/messaging/presentation/MessagingFrame.Mailbox.cpp
    src/modules/messaging/presentation/MessagingFrame.Actions.cpp
    src/modules/messaging/presentation/MessagingFrame.Events.cpp
    src/modules/messaging/presentation/MessagingFrame.State.cpp
    src/modules/messaging/presentation/MessagingScreenCoordinator.cpp

    src/modules/social/application/SocialService.cpp
    src/modules/social/infrastructure/SocialApi.cpp
    src/modules/social/infrastructure/SocialPayloadCodec.cpp
    src/modules/social/presentation/SocialActionController.cpp
    src/modules/social/presentation/SocialDataStore.cpp
    src/modules/social/presentation/SocialEventRouter.cpp
    src/modules/social/presentation/SocialFrame.Bindings.cpp
    src/modules/social/presentation/SocialFrame.cpp
    src/modules/social/presentation/SocialFrame.Layout.cpp
    src/modules/social/presentation/SocialFrame.Events.cpp
    src/modules/social/presentation/SocialFrame.Menu.cpp
    src/modules/social/presentation/SocialFrame.Navigation.cpp
    src/modules/social/presentation/SocialProfileCoordinator.cpp
    src/modules/social/presentation/SocialScreenCoordinator.cpp
    src/modules/social/presentation/SocialPresentationModel.cpp
    src/modules/social/presentation/SocialSectionCoordinator.cpp
    src/modules/social/presentation/SocialFrame.Profile.cpp
    src/modules/social/presentation/SocialSelectionMemory.cpp
    src/modules/social/presentation/SocialSectionPresenter.Core.cpp
    src/modules/social/presentation/SocialSectionPresenter.Profile.cpp
    src/modules/social/presentation/SocialSectionPresenter.Selection.cpp
    src/modules/social/presentation/SocialView.cpp
    src/modules/social/presentation/SocialView.Layout.cpp
    src/modules/social/presentation/SocialView.ListSections.cpp
    src/modules/social/presentation/SocialView.Profile.cpp
    src/modules/social/presentation/SocialView.Theme.cpp

    src/modules/home/application/HomeAuthValidator.cpp
    src/modules/home/presentation/HomeFrame.cpp
    src/modules/home/presentation/HomeFrame.Layout.cpp
    src/modules/home/presentation/HomeFrame.Theme.cpp
    src/modules/home/presentation/HomeFrame.Navigation.cpp
    src/modules/home/presentation/HomeFrame.Events.cpp
    src/modules/home/presentation/HomeFrame.Submit.cpp

    src/modules/options/application/OptionsStore.cpp
    src/modules/options/infrastructure/FileOptionsRepository.cpp
    src/modules/options/infrastructure/OptionsJsonDocumentCodec.cpp
    src/modules/options/infrastructure/OptionsJsonSchemaMigrator.cpp
    src/modules/options/infrastructure/OptionsStateJsonMapper.cpp
    src/modules/options/presentation/OptionsEventBinder.cpp
    src/modules/options/presentation/OptionsFrame.cpp
    src/modules/options/presentation/OptionsFocusController.cpp
    src/modules/options/presentation/OptionsSectionCoordinator.cpp
    src/modules/options/presentation/OptionsView.cpp
    src/modules/options/presentation/OptionsView.Layout.cpp
    src/modules/options/presentation/OptionsView.State.cpp
    src/modules/options/presentation/OptionsViewPagesBuilder.cpp
    src/modules/options/presentation/OptionsViewStateAdapter.cpp
    src/modules/options/presentation/OptionsView.Pages.cpp
    src/modules/options/presentation/OptionsView.Theme.cpp

    src/modules/presence/application/PresenceMonitor.cpp
    src/modules/presence/infrastructure/PresenceConnectionFactory.cpp
    src/modules/presence/infrastructure/PresencePayloadCodec.cpp
    src/modules/presence/presentation/PresenceActionController.cpp
    src/modules/presence/presentation/PresenceFrame.Actions.cpp
    src/modules/presence/presentation/PresenceFrame.cpp
    src/modules/presence/presentation/PresenceFrame.Events.cpp
    src/modules/presence/presentation/PresenceFrame.Layout.cpp
    src/modules/presence/presentation/PresenceFrame.State.cpp
    src/modules/presence/presentation/PresencePresentationModel.cpp

    src/modules/user/application/LoginUseCase.cpp
    src/modules/user/application/RegisterUseCase.cpp
    src/modules/user/infrastructure/remote/JwtLoginClaimsParser.cpp
    src/modules/user/infrastructure/remote/UserAuthRemoteDataSource.cpp
    src/modules/user/infrastructure/WsAuthenticationService.cpp
    src/modules/user/infrastructure/WsSessionRefresher.cpp

    src/modules/main_menu/presentation/MainMenuFrame.cpp
    src/modules/main_menu/presentation/MainMenuContent.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Layout.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Theme.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Events.cpp

    src/modules/session/application/SessionStore.cpp
    src/modules/session/infrastructure/FileSessionRepository.cpp

    src/shared/accessibility/presentation/ActionButton.cpp
    src/shared/accessibility/presentation/AccessibilityUtils.cpp
    src/shared/accessibility/presentation/AccessibleListBox.cpp
    src/shared/accessibility/presentation/AccessibleListBox.Actions.cpp
    src/shared/accessibility/application/FocusCoordinator.cpp
    src/shared/accessibility/application/FocusMemory.cpp
    src/shared/accessibility/application/FocusManager.cpp
    src/shared/accessibility/application/FocusTransition.cpp
    src/shared/accessibility/application/NavigationController.cpp
    src/shared/accessibility/application/NavigationScope.cpp
    src/shared/accessibility/application/NavigationBindings.cpp

    src/modules/audio/application/AudioService.cpp
    src/modules/audio/application/SoundVolumeResolver.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/modules/audio/infrastructure/AsyncAudioBackend.cpp
    src/modules/audio/infrastructure/BassAudioBackend.cpp
    src/modules/audio/infrastructure/BassSampleCache.cpp
    src/modules/audio/infrastructure/BassStreamCache.cpp
    src/modules/audio/infrastructure/LocalSoundManifest.cpp
    src/modules/audio/infrastructure/OptionsAudioSettingsProvider.cpp
    src/modules/audio/infrastructure/SoundAssetPath.cpp
    src/modules/audio/presentation/SoundOptionsCatalog.cpp

    src/shared/config/domain/AppConfig.cpp
    src/shared/config/infrastructure/AppDataPaths.cpp

    src/shared/network/application/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/application/realtime/RealtimeApiClient.cpp
    src/shared/network/application/realtime/RealtimeProtocol.cpp
    src/shared/network/infrastructure/http/WsTicketProvider.cpp
    src/shared/network/infrastructure/http/WsTicketTransport.cpp
    src/shared/network/infrastructure/websocket/WinHttpWebSocketClient.cpp
    src/shared/network/infrastructure/websocket/WinHttpWebSocketRequest.cpp
    src/shared/network/infrastructure/websocket/WinHttpWebSocketInternals.cpp

    src/shared/persistence/infrastructure/JsonFileStorage.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/ui/presentation/controls/VerticalMenu.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Layout.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Events.cpp
    src/shared/ui/presentation/controls/VerticalMenu.Entries.cpp
    src/shared/ui/presentation/controls/VerticalMenuEntry.cpp
    src/shared/security/infrastructure/SecurityUtils.cpp
    src/modules/update/application/UpdateSignals.cpp
    src/shared/security/domain/JwtPayload.cpp
    src/shared/logging/infrastructure/Logger.cpp
    src/shared/ui/presentation/theme/Theme.cpp
)

if(WIN32)
    add_executable(lila_launcher WIN32
        src/modules/update/infrastructure/launcher/LauncherMain.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.cpp
        src/modules/update/domain/UpdateProtocol.cpp
    )
    target_include_directories(lila_launcher PRIVATE
        src
        ${CMAKE_CURRENT_BINARY_DIR}/generated
    )
    target_link_libraries(lila_launcher PRIVATE
        nlohmann_json::nlohmann_json
        winhttp
        bcrypt
        crypt32
        wintrust
        shell32
        user32
    )
    if(MSVC)
        target_compile_options(lila_launcher PRIVATE /W4 /permissive- /utf-8)
    endif()
endif()

add_dependencies(lemonde_de_lila_wx generate_protocol_contracts)

target_include_directories(lemonde_de_lila_wx PRIVATE
    src
    ${CMAKE_CURRENT_BINARY_DIR}/generated
    $<$<BOOL:${WIN32}>:${LILA_BASS_ROOT}/include>
)

target_link_libraries(lemonde_de_lila_wx PRIVATE
    wx::core
    wx::base
    nlohmann_json::nlohmann_json
)

if(WIN32)
    target_link_libraries(lemonde_de_lila_wx PRIVATE
        winhttp
        crypt32
        "${LILA_BASS_ROOT}/lib/x64/bass.lib"
    )
endif()

if(MSVC)
    target_compile_options(lemonde_de_lila_wx PRIVATE
        /W4
        /permissive-
        /utf-8
    )
    if(LILA_ENABLE_ASAN)
        target_compile_options(lemonde_de_lila_wx PRIVATE /fsanitize=address)
        target_link_options(lemonde_de_lila_wx PRIVATE /INCREMENTAL:NO /fsanitize=address)
    endif()
    if(LILA_ENABLE_UBSAN OR LILA_ENABLE_TSAN)
        message(WARNING "UBSan/TSan non supportes dans cette configuration MSVC. Utiliser Clang ou GCC.")
    endif()
else()
    target_compile_options(lemonde_de_lila_wx PRIVATE
        -Wall
        -Wextra
        -Wpedantic
    )
    if(LILA_ENABLE_ASAN)
        target_compile_options(lemonde_de_lila_wx PRIVATE -fsanitize=address)
        target_link_options(lemonde_de_lila_wx PRIVATE -fsanitize=address)
    endif()
    if(LILA_ENABLE_UBSAN)
        target_compile_options(lemonde_de_lila_wx PRIVATE -fsanitize=undefined)
        target_link_options(lemonde_de_lila_wx PRIVATE -fsanitize=undefined)
    endif()
    if(LILA_ENABLE_TSAN)
        target_compile_options(lemonde_de_lila_wx PRIVATE -fsanitize=thread)
        target_link_options(lemonde_de_lila_wx PRIVATE -fsanitize=thread)
    endif()
endif()

if(BUILD_TESTING)
    set(NETWORK_PROTOCOL_TEST
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/NetworkProtocolTests.cpp"
    )

    if(EXISTS "${NETWORK_PROTOCOL_TEST}")
        add_executable(lemonde_de_lila_wx_tests
            tests/NetworkProtocolTests.cpp
            src/modules/update/domain/UpdateProtocol.cpp
            src/modules/catalog/infrastructure/CatalogPayloadCodec.cpp
            src/modules/catalog/presentation/CatalogShelfNavigator.cpp
            src/modules/rooms/infrastructure/RoomPayloadCodec.cpp
            src/modules/rooms/application/RoomSessionService.cpp
            src/modules/rooms/application/RoomSessionService.Realtime.cpp
            src/modules/rooms/infrastructure/RoomSessionGateway.cpp
            src/modules/rooms/infrastructure/RoomSessionGateway.Commands.cpp
            src/modules/rooms/infrastructure/RoomSessionGateway.CommandResponses.cpp
            src/modules/rooms/infrastructure/RoomSessionGateway.State.cpp
            src/modules/rooms/presentation/RoomLobbyNavigator.cpp
            src/modules/rooms/presentation/RoomOpenRequest.cpp
            src/modules/rooms/presentation/RoomPresentationModel.cpp
            src/modules/rooms/presentation/RoomShortcutPolicy.cpp
            src/modules/vault/infrastructure/VaultPayloadCodec.cpp
            src/modules/vault/presentation/VaultNavigator.cpp
            src/modules/vault/presentation/VaultPresentationModel.cpp
            src/modules/storybook/infrastructure/StoryBookPayloadCodec.cpp
            src/modules/storybook/presentation/StoryBookNavigator.cpp
            src/modules/leaderboard/infrastructure/LeaderboardPayloadCodec.cpp
            src/modules/leaderboard/presentation/LeaderboardNavigator.cpp
            src/modules/chat/application/ChatService.cpp
            src/modules/chat/application/ChatService.Connection.cpp
            src/modules/chat/application/ChatService.Messages.cpp
            src/modules/chat/application/ChatService.Reconnect.cpp
            src/modules/chat/application/ChatMessageStore.cpp
            src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
            src/modules/chat/infrastructure/ChatProtocol.cpp
            src/modules/options/application/OptionsStore.cpp
            src/modules/options/infrastructure/OptionsJsonDocumentCodec.cpp
            src/modules/options/infrastructure/OptionsJsonSchemaMigrator.cpp
            src/modules/options/infrastructure/OptionsStateJsonMapper.cpp
            src/modules/session/application/SessionStore.cpp
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
            crypt32
        )

        if(WIN32)
            target_link_libraries(lemonde_de_lila_wx_tests PRIVATE
                winhttp
            )
        endif()

        if(MSVC)
            target_compile_options(lemonde_de_lila_wx_tests PRIVATE
                /W4
                /permissive-
                /utf-8
            )
            if(LILA_ENABLE_ASAN)
                target_compile_options(lemonde_de_lila_wx_tests PRIVATE /fsanitize=address)
                target_link_options(lemonde_de_lila_wx_tests PRIVATE /INCREMENTAL:NO /fsanitize=address)
            endif()
        else()
            target_compile_options(lemonde_de_lila_wx_tests PRIVATE
                -Wall
                -Wextra
                -Wpedantic
            )
            if(LILA_ENABLE_ASAN)
                target_compile_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=address)
                target_link_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=address)
            endif()
            if(LILA_ENABLE_UBSAN)
                target_compile_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=undefined)
                target_link_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=undefined)
            endif()
            if(LILA_ENABLE_TSAN)
                target_compile_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=thread)
                target_link_options(lemonde_de_lila_wx_tests PRIVATE -fsanitize=thread)
            endif()
        endif()

        add_test(
            NAME lemonde_de_lila_wx_tests
            COMMAND lemonde_de_lila_wx_tests
        )

        add_executable(lemonde_de_lila_wx_parser_fuzz
            tests/ParserFuzzHarness.cpp
            src/modules/chat/infrastructure/ChatEventPayloadCodec.cpp
            src/modules/chat/infrastructure/ChatProtocol.cpp
            src/shared/config/domain/AppConfig.cpp
            src/shared/network/application/realtime/RealtimeProtocol.cpp
            src/shared/text/presentation/encoding/Encoding.cpp
            src/shared/text/presentation/catalog/UiTextCatalog.cpp
            src/shared/logging/infrastructure/Logger.cpp
        )

        target_include_directories(lemonde_de_lila_wx_parser_fuzz PRIVATE
            src
            ${CMAKE_CURRENT_BINARY_DIR}/generated
        )

        target_link_libraries(lemonde_de_lila_wx_parser_fuzz PRIVATE
            nlohmann_json::nlohmann_json
            wx::core
            wx::base
        )
    else()
        message(WARNING
            "BUILD_TESTING est actif, mais tests/NetworkProtocolTests.cpp "
            "est absent. La cible de tests ne sera pas generee."
        )
    endif()
endif()

