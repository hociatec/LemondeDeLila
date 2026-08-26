Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma
!include x64.nsh

!ifndef APP_VERSION
  !error "APP_VERSION is required"
!endif
!ifndef PAYLOAD_DIR
  !error "PAYLOAD_DIR is required"
!endif
!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE is required"
!endif

Name "Le Monde de Lila"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\LeMondeDeLilaWX"
InstallDirRegKey HKCU "Software\Hociatec\LeMondeDeLilaWX" "InstallDir"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "Le Monde de Lila"
VIAddVersionKey "CompanyName" "Hociatec"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "FileDescription" "Installateur Le Monde de Lila"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Le Monde de Lila nécessite Windows 64 bits."
    Abort
  ${EndIf}
FunctionEnd

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Application" SEC_APPLICATION
  SetShellVarContext current
  SetOutPath "$INSTDIR\app"
  File /r "${PAYLOAD_DIR}/*.*"
  SetOutPath "$INSTDIR"
  File /oname=lila_launcher.exe "${PAYLOAD_DIR}/lila_launcher.exe"
  WriteRegStr HKCU "Software\Hociatec\LeMondeDeLilaWX" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Le Monde de Lila"
  CreateShortcut "$SMPROGRAMS\Le Monde de Lila\Le Monde de Lila.lnk" "$INSTDIR\lila_launcher.exe" "" "$INSTDIR\lila_launcher.exe"
  CreateShortcut "$DESKTOP\Le Monde de Lila.lnk" "$INSTDIR\lila_launcher.exe" "" "$INSTDIR\lila_launcher.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\Le Monde de Lila.lnk"
  Delete "$SMPROGRAMS\Le Monde de Lila\Le Monde de Lila.lnk"
  RMDir "$SMPROGRAMS\Le Monde de Lila"
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\lila_launcher.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Hociatec\LeMondeDeLilaWX"
SectionEnd
