file(GLOB LILA_ADMIN_QUIZ_TEST_SOURCES CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/modules/admin/presentation/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/modules/admin/domain/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/shared/ui/presentation/controls/VerticalMenu*.cpp"
)
lila_add_test_executable(lemonde_de_lila_wx_admin_quiz_navigation_tests
    tests/AdminQuizNavigationTests.cpp
    ${LILA_ADMIN_QUIZ_TEST_SOURCES}
    src/modules/admin/application/AdminService.cpp
    src/modules/admin/infrastructure/AdminPayloadValidator.cpp
    src/modules/audio/domain/SoundCatalog.cpp
    src/shared/accessibility/presentation/AccessibilityUtils.cpp
    src/shared/accessibility/presentation/AccessibleListBox.cpp
    src/shared/accessibility/presentation/AccessibleListBox.Actions.cpp
    src/shared/accessibility/presentation/ActivationFocusContext.cpp
    src/shared/accessibility/presentation/NavigationController.cpp
    src/shared/accessibility/presentation/NavigationScope.cpp
    src/shared/accessibility/presentation/NavigationBindings.cpp
    src/shared/accessibility/presentation/FocusManager.cpp
    src/shared/concurrency/application/BackgroundExecutor.cpp
    src/shared/concurrency/application/BackgroundTasks.cpp
    src/shared/ui/presentation/theme/Theme.cpp
    src/shared/text/presentation/catalog/UiTextCatalog.cpp
    src/shared/text/presentation/encoding/Encoding.cpp
    src/shared/logging/infrastructure/Logger.cpp
    src/shared/security/infrastructure/SecurityUtils.cpp
)
target_link_libraries(lemonde_de_lila_wx_admin_quiz_navigation_tests
    PRIVATE ${wxWidgets_LIBRARIES} nlohmann_json::nlohmann_json)
if(WIN32)
    target_link_libraries(lemonde_de_lila_wx_admin_quiz_navigation_tests PRIVATE crypt32 bcrypt)
    target_sources(lemonde_de_lila_wx_admin_quiz_navigation_tests PRIVATE tests/WindowsGuiTests.rc)
    if(MSVC)
        target_link_options(lemonde_de_lila_wx_admin_quiz_navigation_tests PRIVATE /MANIFEST:NO)
    endif()
endif()
