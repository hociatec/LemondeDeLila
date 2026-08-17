@echo off
setlocal

call "C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1

set "SOURCE_DIR=C:\wamp64\www\lemondeDeLila\client-wx"
set "BUILD_DIR=%SOURCE_DIR%\build\codex-nmake-debug"
set "TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake"

cmake -S "%SOURCE_DIR%" -B "%BUILD_DIR%" -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE="%TOOLCHAIN_FILE%"
if errorlevel 1 exit /b 1

cmake --build "%BUILD_DIR%"
if errorlevel 1 exit /b 1

endlocal
