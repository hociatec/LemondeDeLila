#pragma once

// BASS' stock header intentionally omits dllimport. That is fine with its
// vendor import libraries, but MinGW can otherwise turn calls into 32-bit
// runtime pseudo-relocations when an import definition was classified as
// DATA. Those relocations overflow whenever Windows maps bass.dll more than
// 2 GiB away from the executable. Force true IAT calls on MinGW so the full
// 64-bit function address supplied by the Windows loader is always used.
#if defined(_WIN32) && defined(__MINGW32__)
#define BASSDEF(functionName) __declspec(dllimport) WINAPI functionName
#endif

#include <bass.h>
