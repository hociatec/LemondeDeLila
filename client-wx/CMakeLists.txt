cmake_minimum_required(VERSION 3.28)

project(lemonde_de_lila_wx VERSION 1.2.651.0 LANGUAGES CXX)

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
    src/shared/config/AppBuildInfo.h.in
    ${CMAKE_CURRENT_BINARY_DIR}/generated/AppBuildInfo.h
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
    LILA_BACKEND_WS_EVENTS_FILE
    "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/common/ws/ws-events.ts"
    CACHE FILEPATH
    "Source canonique des événements WebSocket du backend"
)

set(
    LILA_PROTOCOL_FIELDS_SCRIPT
    "${CMAKE_CURRENT_SOURCE_DIR}/scripts/GenerateProtocolFields.ps1"
)

set(
    LILA_BACKEND_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../backend"
    CACHE PATH
    "Racine locale du backend utilisee pour regenerer les contrats protocole"
)

set(
    LILA_GENERATED_PROTOCOL_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/UserAuthFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/SocialProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/ChatProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/MessagingProtocolFields.generated.h"
)

set(
    LILA_PROTOCOL_GENERATION_DEPENDENCIES
    "${LILA_BACKEND_ROOT}/src/user/ws/auth-ws.handler.ts"
    "${LILA_BACKEND_ROOT}/src/user/services/user.auth.service.ts"
    "${LILA_BACKEND_ROOT}/src/social/services/social-profile.service.ts"
    "${LILA_BACKEND_ROOT}/src/social/services/social-relationship.service.ts"
    "${LILA_BACKEND_ROOT}/src/presence/services/presence-chat.service.ts"
    "${LILA_BACKEND_ROOT}/src/chat/services/chat.service.ts"
    "${LILA_BACKEND_ROOT}/src/messaging/services/messaging.service.ts"
    "${LILA_BACKEND_ROOT}/src/messaging/ws/ws.dto.ts"
    "${LILA_BACKEND_ROOT}/src/messaging/ws/messaging-ws.handler.ts"
)

set(LILA_CAN_GENERATE_PROTOCOL_FIELDS ON)
foreach(protocol_dependency IN LISTS LILA_PROTOCOL_GENERATION_DEPENDENCIES)
    if(NOT EXISTS "${protocol_dependency}")
        set(LILA_CAN_GENERATE_PROTOCOL_FIELDS OFF)
        break()
    endif()
endforeach()

if(LILA_CAN_GENERATE_PROTOCOL_FIELDS)
    add_custom_command(
        OUTPUT ${LILA_GENERATED_PROTOCOL_HEADERS}
        COMMAND powershell
            -ExecutionPolicy Bypass
            -File "${LILA_PROTOCOL_FIELDS_SCRIPT}"
            -BackendRoot "${LILA_BACKEND_ROOT}"
            -OutputRoot "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol"
        DEPENDS
            "${LILA_PROTOCOL_FIELDS_SCRIPT}"
            ${LILA_PROTOCOL_GENERATION_DEPENDENCIES}
        VERBATIM
    )

    add_custom_target(generate_protocol_fields DEPENDS ${LILA_GENERATED_PROTOCOL_HEADERS})
    message(STATUS "Backend local detecte : regeneration des contrats protocole activee.")
else()
    add_custom_target(generate_protocol_fields)
    message(STATUS "Backend local introuvable : utilisation des contrats protocole versionnes dans le client.")
endif()

add_executable(lemonde_de_lila_wx WIN32
    src/app/main.cpp
    src/app/Application.cpp
    src/app/navigation/AppNavigator.cpp
    src/app/navigation/HostFrame.cpp
    src/bootstrap/AppBootstrap.cpp
    src/bootstrap/AppCompositions.Network.cpp
    src/bootstrap/AppCompositions.User.cpp
    src/bootstrap/AppCompositions.Game.cpp
    src/bootstrap/AppCompositions.Social.cpp
    src/bootstrap/AppRuntime.cpp

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

    src/modules/main_menu/presentation/MainMenuFrame.cpp
    src/modules/main_menu/presentation/MainMenuContent.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Layout.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Theme.cpp
    src/modules/main_menu/presentation/MainMenuFrame.Events.cpp

    src/modules/session/application/SessionStore.cpp
    src/modules/session/infrastructure/FileSessionRepository.cpp

    src/shared/accessibility/ActionButton.cpp
    src/shared/accessibility/AccessibilityUtils.cpp
    src/shared/accessibility/FocusCoordinator.cpp
    src/shared/accessibility/FocusMemory.cpp
    src/shared/accessibility/FocusManager.cpp
    src/shared/accessibility/FocusTransition.cpp
    src/shared/accessibility/NavigationController.cpp

    src/shared/audio/AudioService.cpp
    src/shared/audio/SoundCatalog.cpp

    src/shared/config/AppConfig.cpp
    src/shared/config/AppDataPaths.cpp

    src/shared/network/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeProtocol.cpp
    src/shared/network/http/WsTicketProvider.cpp
    src/shared/network/http/WsTicketTransport.cpp
    src/shared/network/websocket/WinHttpWebSocketClient.cpp
    src/shared/network/websocket/WinHttpWebSocketInternals.cpp

    src/shared/persistence/JsonFileStorage.cpp
    src/shared/concurrency/BackgroundExecutor.cpp
    src/shared/text/Encoding.cpp
    src/shared/text/UiTextCatalog.cpp
    src/shared/ui/controls/VerticalMenu.cpp
    src/shared/ui/controls/VerticalMenu.Entries.cpp
    src/shared/ui/controls/VerticalMenuEntry.cpp
    src/shared/security/SecurityUtils.cpp
    src/shared/security/JwtPayload.cpp
    src/shared/logging/Logger.cpp
    src/shared/ui/Theme.cpp
)

add_dependencies(lemonde_de_lila_wx generate_protocol_fields)

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
            src/shared/concurrency/BackgroundExecutor.cpp
            src/shared/accessibility/ActionButton.cpp
            src/shared/accessibility/NavigationController.cpp
            src/shared/audio/AudioService.cpp
            src/shared/audio/SoundCatalog.cpp
            src/shared/config/AppConfig.cpp
            src/shared/config/AppDataPaths.cpp
            src/shared/network/http/WsTicketProvider.cpp
            src/shared/network/http/WsTicketTransport.cpp
            src/shared/network/realtime/RealtimeProtocol.cpp
            src/shared/security/SecurityUtils.cpp
            src/shared/security/JwtPayload.cpp
            src/shared/text/Encoding.cpp
            src/shared/text/UiTextCatalog.cpp
            src/shared/logging/Logger.cpp
            src/shared/persistence/JsonFileStorage.cpp
        )

        target_include_directories(lemonde_de_lila_wx_tests PRIVATE
            src
            ${CMAKE_CURRENT_BINARY_DIR}/generated
            $<$<BOOL:${WIN32}>:${LILA_BASS_ROOT}/include>
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
                "${LILA_BASS_ROOT}/lib/x64/bass.lib"
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
            src/shared/config/AppConfig.cpp
            src/shared/network/realtime/RealtimeProtocol.cpp
            src/shared/text/Encoding.cpp
            src/shared/text/UiTextCatalog.cpp
            src/shared/logging/Logger.cpp
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

