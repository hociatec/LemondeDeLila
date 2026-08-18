cmake_minimum_required(VERSION 3.31)

project(lemonde_de_lila_wx VERSION 1.2.651.0 LANGUAGES CXX)

include(CTest)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(wxWidgets CONFIG REQUIRED COMPONENTS core base)
find_package(nlohmann_json CONFIG REQUIRED)

configure_file(
    src/shared/config/AppBuildInfo.h.in
    ${CMAKE_CURRENT_BINARY_DIR}/generated/AppBuildInfo.h
    @ONLY
)

add_executable(lemonde_de_lila_wx WIN32
    src/app/main.cpp
    src/app/Application.cpp
    src/app/navigation/AppNavigator.cpp
    src/bootstrap/AppBootstrap.cpp

    src/modules/about/presentation/AboutFrame.cpp

    src/modules/chat/application/ChatService.cpp
    src/modules/chat/application/ChatService.Connection.cpp
    src/modules/chat/application/ChatService.Messages.cpp
    src/modules/chat/application/ChatMessageStore.cpp
    src/modules/chat/infrastructure/ChatProtocol.cpp
    src/modules/chat/infrastructure/PresenceChatGateway.cpp
    src/modules/chat/presentation/ChatFrame.cpp
    src/modules/chat/presentation/ChatFrame.Layout.cpp
    src/modules/chat/presentation/ChatFrame.Events.cpp
    src/modules/chat/presentation/ChatFrame.History.cpp

    src/modules/messaging/application/MessagingService.cpp
    src/modules/messaging/infrastructure/MessagingApi.cpp
    src/modules/messaging/presentation/MessagingPresentationModel.cpp
    src/modules/messaging/presentation/MessagingFrame.cpp
    src/modules/messaging/presentation/MessagingFrame.Events.cpp

    src/modules/social/application/SocialService.cpp
    src/modules/social/infrastructure/SocialApi.cpp
    src/modules/social/presentation/SocialFrame.cpp
    src/modules/social/presentation/SocialFrame.Layout.cpp
    src/modules/social/presentation/SocialFrame.Events.cpp
    src/modules/social/presentation/SocialFrame.Sections.cpp

    src/modules/home/application/HomeAuthValidator.cpp
    src/modules/home/presentation/HomeFrame.cpp
    src/modules/home/presentation/HomeFrame.Layout.cpp
    src/modules/home/presentation/HomeFrame.Theme.cpp
    src/modules/home/presentation/HomeFrame.Navigation.cpp
    src/modules/home/presentation/HomeFrame.Events.cpp
    src/modules/home/presentation/HomeFrame.Submit.cpp

    src/modules/options/application/OptionsStore.cpp
    src/modules/options/infrastructure/FileOptionsRepository.cpp
    src/modules/options/presentation/OptionsFrame.cpp

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

    src/shared/network/realtime/AuthenticatedRealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeApiClient.cpp
    src/shared/network/realtime/RealtimeProtocol.cpp
    src/shared/network/http/WsTicketProvider.cpp
    src/shared/network/websocket/WinHttpWebSocketClient.cpp

    src/shared/persistence/JsonFileStorage.cpp
    src/shared/concurrency/BackgroundExecutor.cpp
    src/shared/text/Encoding.cpp
    src/shared/ui/controls/VerticalMenu.cpp
    src/shared/ui/Theme.cpp
)

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
    target_link_libraries(lemonde_de_lila_wx PRIVATE winhttp)
endif()

if(MSVC)
    target_compile_options(lemonde_de_lila_wx PRIVATE
        /W4
        /permissive-
        /utf-8
    )
else()
    target_compile_options(lemonde_de_lila_wx PRIVATE
        -Wall
        -Wextra
        -Wpedantic
    )
endif()

if(BUILD_TESTING)
    set(NETWORK_PROTOCOL_TEST
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/NetworkProtocolTests.cpp"
    )

    if(EXISTS "${NETWORK_PROTOCOL_TEST}")
        add_executable(lemonde_de_lila_wx_tests
            tests/NetworkProtocolTests.cpp
            src/shared/network/realtime/RealtimeProtocol.cpp
            src/modules/chat/infrastructure/ChatProtocol.cpp
            src/modules/chat/application/ChatMessageStore.cpp
        )

        target_include_directories(lemonde_de_lila_wx_tests PRIVATE
            src
        )

        target_link_libraries(lemonde_de_lila_wx_tests PRIVATE
            nlohmann_json::nlohmann_json
        )

        if(MSVC)
            target_compile_options(lemonde_de_lila_wx_tests PRIVATE
                /W4
                /permissive-
                /utf-8
            )
        else()
            target_compile_options(lemonde_de_lila_wx_tests PRIVATE
                -Wall
                -Wextra
                -Wpedantic
            )
        endif()

        add_test(
            NAME lemonde_de_lila_wx_tests
            COMMAND lemonde_de_lila_wx_tests
        )
    else()
        message(WARNING
            "BUILD_TESTING est actif, mais tests/NetworkProtocolTests.cpp "
            "est absent. La cible de tests ne sera pas generee."
        )
    endif()
endif()
