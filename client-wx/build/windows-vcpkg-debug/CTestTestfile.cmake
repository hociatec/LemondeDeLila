# CMake generated Testfile for 
# Source directory: C:/wamp64/www/lemondeDeLila/client-wx
# Build directory: C:/wamp64/www/lemondeDeLila/client-wx/build/windows-vcpkg-debug
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
if(CTEST_CONFIGURATION_TYPE MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
  add_test([=[lemonde_de_lila_wx_tests]=] "C:/wamp64/www/lemondeDeLila/client-wx/build/windows-vcpkg-debug/Debug/lemonde_de_lila_wx_tests.exe")
  set_tests_properties([=[lemonde_de_lila_wx_tests]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;508;add_test;C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
  add_test([=[lemonde_de_lila_wx_tests]=] "C:/wamp64/www/lemondeDeLila/client-wx/build/windows-vcpkg-debug/Release/lemonde_de_lila_wx_tests.exe")
  set_tests_properties([=[lemonde_de_lila_wx_tests]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;508;add_test;C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Mm][Ii][Nn][Ss][Ii][Zz][Ee][Rr][Ee][Ll])$")
  add_test([=[lemonde_de_lila_wx_tests]=] "C:/wamp64/www/lemondeDeLila/client-wx/build/windows-vcpkg-debug/MinSizeRel/lemonde_de_lila_wx_tests.exe")
  set_tests_properties([=[lemonde_de_lila_wx_tests]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;508;add_test;C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;0;")
elseif(CTEST_CONFIGURATION_TYPE MATCHES "^([Rr][Ee][Ll][Ww][Ii][Tt][Hh][Dd][Ee][Bb][Ii][Nn][Ff][Oo])$")
  add_test([=[lemonde_de_lila_wx_tests]=] "C:/wamp64/www/lemondeDeLila/client-wx/build/windows-vcpkg-debug/RelWithDebInfo/lemonde_de_lila_wx_tests.exe")
  set_tests_properties([=[lemonde_de_lila_wx_tests]=] PROPERTIES  _BACKTRACE_TRIPLES "C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;508;add_test;C:/wamp64/www/lemondeDeLila/client-wx/CMakeLists.txt;0;")
else()
  add_test([=[lemonde_de_lila_wx_tests]=] NOT_AVAILABLE)
endif()
