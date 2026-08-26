cmake_minimum_required(VERSION 3.28)

set(LILA_PROJECT_VERSION "1.2.651.0" CACHE STRING "Version à quatre composants du client WX")
project(lemonde_de_lila_wx VERSION ${LILA_PROJECT_VERSION} LANGUAGES CXX)

set(LILA_UPDATE_PUBLIC_KEY_DER_BASE64 "" CACHE STRING "Clé publique RSA DER/base64 des manifestes de mise à jour")
set(LILA_UPDATE_AUTHENTICODE_SIGNER_SHA256 "" CACHE STRING "Empreinte SHA-256 du certificat Authenticode autorisé")
set(LILA_UPDATE_MANIFEST_URL "https://api.lilas.hociatec.fr/api/client/releases/latest?platform=windows&arch=x64" CACHE STRING "URL du manifeste de mise à jour WX")

include(CTest)

option(LILA_ENABLE_ASAN "Enable AddressSanitizer where supported" OFF)
option(LILA_ENABLE_UBSAN "Enable UndefinedBehaviorSanitizer where supported" OFF)
option(LILA_ENABLE_TSAN "Enable ThreadSanitizer where supported" OFF)
option(LILA_ENABLE_CLANG_TIDY "Enable clang-tidy during compilation" OFF)
option(LILA_ENABLE_CPPCHECK "Enable cppcheck during compilation" OFF)

if(LILA_ENABLE_ASAN AND LILA_ENABLE_TSAN)
    message(FATAL_ERROR "ASan et TSan ne peuvent pas etre actives simultanement.")
endif()

include(cmake/LilaTargetOptions.cmake)

set(LILA_MAX_IMPLEMENTATION_LINES 250)
file(GLOB_RECURSE LILA_IMPLEMENTATION_FILES CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp"
)
file(GLOB_RECURSE LILA_TEST_IMPLEMENTATION_FILES CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/tests/*.inc"
)
set(LILA_SIZE_GUARDED_FILES
    ${LILA_IMPLEMENTATION_FILES}
    ${LILA_TEST_IMPLEMENTATION_FILES}
)
foreach(implementation_file IN LISTS LILA_SIZE_GUARDED_FILES)
    file(READ "${implementation_file}" implementation_content)
    string(REGEX MATCHALL "\n" implementation_line_breaks "${implementation_content}")
    list(LENGTH implementation_line_breaks implementation_line_count)
    math(EXPR implementation_line_count "${implementation_line_count} + 1")
    if(implementation_line_count GREATER LILA_MAX_IMPLEMENTATION_LINES)
        message(FATAL_ERROR
            "Fichier C++ trop volumineux (${implementation_line_count} lignes): "
            "${implementation_file}. Decouper le fichier par responsabilite."
        )
    endif()
endforeach()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(WIN32)
    enable_language(RC)
    # Les en-têtes MinGW n'exposent pas les API CNG/Vista+ sans cible Windows
    # explicite.
    add_compile_definitions(_WIN32_WINNT=0x0601 NTDDI_VERSION=0x06010000)

    set(
        LILA_WINDOWS_MANIFEST
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/windows/LeMondeDeLila.manifest"
    )
    set(
        LILA_WINDOWS_RESOURCE
        "${CMAKE_CURRENT_BINARY_DIR}/generated/LeMondeDeLila.rc"
    )
    configure_file(
        resources/windows/LeMondeDeLila.rc.in
        "${LILA_WINDOWS_RESOURCE}"
        @ONLY
    )
endif()

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
find_package(Threads REQUIRED)

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
    set(
        LILA_BASS_RUNTIME_DLL
        "${LILA_BASS_ROOT}/bin/x64/bass.dll"
        CACHE FILEPATH
        "DLL BASS x64 incluse avec le client"
    )
    set(
        LILA_BASS_IMPORT_LIBRARY
        "${LILA_BASS_ROOT}/lib/x64/bass.lib"
        CACHE FILEPATH
        "Bibliothèque d'import BASS compatible avec le compilateur cible"
    )
    if(NOT EXISTS "${LILA_BASS_RUNTIME_DLL}")
        message(FATAL_ERROR "DLL BASS absente: ${LILA_BASS_RUNTIME_DLL}")
    endif()
    if(NOT EXISTS "${LILA_BASS_IMPORT_LIBRARY}")
        message(FATAL_ERROR "Bibliothèque BASS absente: ${LILA_BASS_IMPORT_LIBRARY}")
    endif()
    configure_file(
        "${LILA_BASS_RUNTIME_DLL}"
        "${CMAKE_CURRENT_BINARY_DIR}/bass.dll"
        COPYONLY
    )
    set(
        LILA_NVDA_CONTROLLER_DLL
        "${CMAKE_CURRENT_SOURCE_DIR}/../client-win/client-win/libs/x64/nvdaControllerClient64.dll"
        CACHE FILEPATH
        "DLL NVDA 64 bits facultative utilisee pour les annonces accessibles"
    )
    if(EXISTS "${LILA_NVDA_CONTROLLER_DLL}")
        file(MAKE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/libs/x64")
        configure_file(
            "${LILA_NVDA_CONTROLLER_DLL}"
            "${CMAKE_CURRENT_BINARY_DIR}/libs/x64/nvdaControllerClient64.dll"
            COPYONLY
        )
    endif()
endif()

set(
    LILA_PROTOCOL_CONTRACTS_SCRIPT
    "${CMAKE_CURRENT_SOURCE_DIR}/scripts/GenerateProtocolContracts.ps1"
)
set(
    LILA_PROTOCOL_CONTRACTS_NODE_SCRIPT
    "${CMAKE_CURRENT_SOURCE_DIR}/scripts/GenerateProtocolContracts.mjs"
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
    if(CMAKE_HOST_WIN32)
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
    else()
        find_program(LILA_NODE_EXECUTABLE node REQUIRED)
        if(NOT EXISTS "${LILA_PROTOCOL_CONTRACTS_NODE_SCRIPT}")
            message(FATAL_ERROR "Generateur Node de contrats absent: ${LILA_PROTOCOL_CONTRACTS_NODE_SCRIPT}")
        endif()
        add_custom_command(
            OUTPUT ${LILA_GENERATED_PROTOCOL_HEADERS}
            COMMAND "${LILA_NODE_EXECUTABLE}"
                "${LILA_PROTOCOL_CONTRACTS_NODE_SCRIPT}"
                --backend-root "${LILA_BACKEND_ROOT}"
                --output-root "${CMAKE_CURRENT_SOURCE_DIR}/src/generated/protocol"
            DEPENDS
                "${LILA_PROTOCOL_CONTRACTS_NODE_SCRIPT}"
                ${LILA_PROTOCOL_GENERATION_DEPENDENCIES}
            VERBATIM
        )
    endif()

    add_custom_target(generate_protocol_contracts DEPENDS ${LILA_GENERATED_PROTOCOL_HEADERS})
    message(STATUS "Backend local detecte : generation stricte des contrats protocole activee.")
else()
    add_custom_target(generate_protocol_contracts)
    message(STATUS "Backend local introuvable : utilisation des contrats protocole versionnes dans le client.")
endif()

set(LILA_CLIENT_SOURCES ${LILA_IMPLEMENTATION_FILES})
list(FILTER LILA_CLIENT_SOURCES EXCLUDE REGEX
    "/modules/update/infrastructure/launcher/"
)
list(FILTER LILA_CLIENT_SOURCES EXCLUDE REGEX
    "/modules/update/domain/Update(Protocol|TrustPolicy)\\.cpp$"
)

add_executable(lemonde_de_lila_wx WIN32
    ${LILA_WINDOWS_RESOURCE}
    ${LILA_CLIENT_SOURCES}
)

if(WIN32)
    add_executable(lila_launcher WIN32
        ${LILA_WINDOWS_RESOURCE}
        src/modules/update/infrastructure/launcher/LauncherMain.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Archive.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Download.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Lifecycle.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Platform.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Prepare.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Process.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Progress.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Runtime.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.Security.cpp
        src/modules/update/infrastructure/launcher/UpdateLauncher.State.cpp
        src/modules/update/domain/UpdateProtocol.cpp
        src/modules/update/domain/UpdateTrustPolicy.cpp
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
        ole32
        uuid
        user32
    )
    if(MINGW)
        # Le lanceur est copié seul à la racine de l'installation et se
        # remplace lui-même lors des mises à jour. Il doit donc pouvoir
        # démarrer sans les runtimes MinGW rangés dans app/ ou versions/*.
        target_link_options(lila_launcher PRIVATE -municode -static)
    endif()
    lila_configure_cpp_target(lila_launcher)
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
        "${LILA_BASS_IMPORT_LIBRARY}"
    )
endif()

if(MINGW)
    target_link_options(lemonde_de_lila_wx PRIVATE
        "-Wl,-Map,${CMAKE_CURRENT_BINARY_DIR}/lemonde_de_lila_wx.map"
    )
endif()

lila_configure_cpp_target(lemonde_de_lila_wx)

if(BUILD_TESTING)
    include(cmake/LilaTests.cmake)
endif()
