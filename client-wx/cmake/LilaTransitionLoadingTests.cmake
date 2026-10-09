file(GLOB LILA_TRANSITION_PANEL_SOURCES CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/modules/rooms/presentation/join/JoinRoomsPanel*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/modules/leaderboard/presentation/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/shared/ui/presentation/controls/VerticalMenu*.cpp"
)
lila_add_test_executable(lemonde_de_lila_wx_transition_loading_tests
    tests/TransitionLoadingTests.cpp
    ${LILA_TRANSITION_PANEL_SOURCES}
    src/modules/rooms/application/RoomLobbyService.cpp
    src/modules/rooms/presentation/navigation/RoomLobbyNavigator.cpp
    src/modules/rooms/presentation/lobby/RoomLobbyPresentationModel.cpp
    src/modules/leaderboard/application/LeaderboardService.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/accessibility/presentation/AccessibilityUtils.cpp
    src/shared/accessibility/presentation/AccessibleListBox.cpp
    src/shared/accessibility/presentation/AccessibleListBox.Actions.cpp
    src/shared/accessibility/presentation/ActivationFocusContext.cpp
    src/shared/accessibility/presentation/NavigationController.cpp
    src/shared/accessibility/presentation/NavigationBindings.cpp
    src/shared/accessibility/presentation/NavigationScope.cpp
    src/shared/accessibility/presentation/FocusManager.cpp
    src/shared/accessibility/presentation/FocusCoordinator.cpp
    src/shared/ui/presentation/layout/ListPageLayout.cpp
    src/shared/ui/presentation/theme/Theme.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/logging/infrastructure/Logger.cpp
)
target_link_libraries(lemonde_de_lila_wx_transition_loading_tests PRIVATE ${wxWidgets_LIBRARIES})
if(WIN32)
    target_sources(lemonde_de_lila_wx_transition_loading_tests PRIVATE tests/WindowsGuiTests.rc)
    if(MSVC)
        target_link_options(lemonde_de_lila_wx_transition_loading_tests PRIVATE /MANIFEST:NO)
    endif()
endif()
set_tests_properties(lemonde_de_lila_wx_transition_loading_tests PROPERTIES TIMEOUT 15)
