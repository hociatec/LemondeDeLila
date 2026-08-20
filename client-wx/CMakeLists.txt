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
    LILA_GENERATED_PROTOCOL_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/UserAuthFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/SocialProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/ChatProtocolFields.generated.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol/MessagingProtocolFields.generated.h"
)

add_custom_command(
    OUTPUT ${LILA_GENERATED_PROTOCOL_HEADERS}
    COMMAND powershell
        -ExecutionPolicy Bypass
        -File "${LILA_PROTOCOL_FIELDS_SCRIPT}"
        -BackendRoot "${CMAKE_CURRENT_SOURCE_DIR}/../backend"
        -OutputRoot "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol"
    DEPENDS
        "${LILA_PROTOCOL_FIELDS_SCRIPT}"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/user/ws/auth-ws.handler.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/user/services/user.auth.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/social/services/social-profile.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/social/services/social-relationship.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/presence/services/presence-chat.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/chat/services/chat.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/messaging/services/messaging.service.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/messaging/ws/ws.dto.ts"
        "${CMAKE_CURRENT_SOURCE_DIR}/../backend/src/messaging/ws/messaging-ws.handler.ts"
    VERBATIM
)

add_custom_target(generate_protocol_fields DEPENDS ${LILA_GENERATED_PROTOCOL_HEADERS})

add_executable(lemonde_de_lila_wx WIN32
    src/app/main.cpp
    src/app/Application.cpp
    src/app/navigation/AppNavigator.cpp
    src/bootstrap/AppBootstrap.cpp
    src/bootstrap/AppRuntime.cpp

    src/modules/about/presentation/AboutFrame.cpp

    src/modules/chat/application/ChatService.cpp
    src/modules/chat/application/ChatService.Connection.cpp
    src/modules/chat/application/ChatService.Messages.cpp
    src/modules/chat/application/ChatMessageStore.cpp
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
    src/modules/messaging/presentation/MessagingActionController.cpp
    src/modules/messaging/presentation/MessagingEventBinder.cpp
    src/modules/messaging/presentation/MessagingFocusController.cpp
    src/modules/messaging/presentation/MessagingPresentationModel.cpp
    src/modules/messaging/presentation/MessagingSelectionMemory.cpp
    src/modules/messaging/presentation/MessagingView.cpp
    src/modules/messaging/presentation/MessagingView.Menu.cpp
    src/modules/messaging/presentation/MessagingView.Detail.cpp
    src/modules/messaging/presentation/MessagingView.Compose.cpp
    src/modules/messaging/presentation/MessagingView.Theme.cpp
    src/modules/messaging/presentation/MessagingFrame.cpp
    src/modules/messaging/presentation/MessagingFrame.Mailbox.cpp
    src/modules/messaging/presentation/MessagingFrame.Actions.cpp
    src/modules/messaging/presentation/MessagingFrame.Events.cpp

    src/modules/social/application/SocialService.cpp
    src/modules/social/infrastructure/SocialApi.cpp
    src/modules/social/presentation/SocialActionController.cpp
    src/modules/social/presentation/SocialDataStore.cpp
    src/modules/social/presentation/SocialEventRouter.cpp
    src/modules/social/presentation/SocialFrame.Bindings.cpp
    src/modules/social/presentation/SocialFrame.cpp
    src/modules/social/presentation/SocialFrame.Layout.cpp
    src/modules/social/presentation/SocialFrame.Events.cpp
    src/modules/social/presentation/SocialFrame.Menu.cpp
    src/modules/social/presentation/SocialFocusController.cpp
    src/modules/social/presentation/SocialFrame.Navigation.cpp
    src/modules/social/presentation/SocialFrame.Loads.cpp
    src/modules/social/presentation/SocialPresentationModel.cpp
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
    src/modules/options/presentation/OptionsEventBinder.cpp
    src/modules/options/presentation/OptionsFrame.cpp
    src/modules/options/presentation/OptionsFocusController.cpp
    src/modules/options/presentation/OptionsView.cpp
    src/modules/options/presentation/OptionsView.Layout.cpp
    src/modules/options/presentation/OptionsView.State.cpp
    src/modules/options/presentation/OptionsView.Pages.cpp
    src/modules/options/presentation/OptionsView.Theme.cpp

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

    src/shared/config/AppConfig.cpp
    src/shared/config/AppDataPaths.cpp

    src/shared/network/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeProtocol.cpp
    src/shared/network/http/WsTicketProvider.cpp
    src/shared/network/websocket/WinHttpWebSocketClient.cpp
    src/shared/network/websocket/WinHttpWebSocketInternals.cpp

    src/shared/persistence/JsonFileStorage.cpp
    src/shared/concurrency/BackgroundExecutor.cpp
    src/shared/text/Encoding.cpp
    src/shared/text/UiTextCatalog.cpp
    src/shared/ui/controls/VerticalMenu.cpp
    src/shared/security/SecurityUtils.cpp
    src/shared/logging/Logger.cpp
    src/shared/ui/Theme.cpp
)

add_dependencies(lemonde_de_lila_wx generate_protocol_fields)

target_include_directories(lemonde_de_lila_wx PRIVATE
    src
    ${CMAKE_CURRENT_BINARY_DIR}/generated
)

target_link_libraries(lemonde_de_lila_wx PRIVATE
    wx::core
    wx::base
    nlohmann_json::nlohmann_json
)

if(WIN32)
    target_link_libraries(lemonde_de_lila_wx PRIVATE winhttp crypt32)
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
            src/modules/chat/application/ChatService.cpp
            src/modules/chat/application/ChatService.Connection.cpp
            src/modules/chat/application/ChatService.Messages.cpp
            src/modules/chat/application/ChatMessageStore.cpp
            src/modules/chat/infrastructure/ChatProtocol.cpp
            src/modules/options/application/OptionsStore.cpp
            src/modules/session/application/SessionStore.cpp
            src/shared/concurrency/BackgroundExecutor.cpp
            src/shared/accessibility/ActionButton.cpp
            src/shared/config/AppConfig.cpp
            src/shared/config/AppDataPaths.cpp
            src/shared/network/http/WsTicketProvider.cpp
            src/shared/network/realtime/RealtimeProtocol.cpp
            src/shared/security/SecurityUtils.cpp
            src/shared/text/Encoding.cpp
            src/shared/text/UiTextCatalog.cpp
            src/shared/logging/Logger.cpp
            src/shared/persistence/JsonFileStorage.cpp
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
            target_link_libraries(lemonde_de_lila_wx_tests PRIVATE winhttp)
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

