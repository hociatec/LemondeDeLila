#define AppName "Le Monde de Lila"
#define AppPublisher "Hociatec"

[Setup]
AppId={{A0F1E7C1-5E9E-4D1F-AF51-8C1B91D7B5C4}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\LeMondeDeLilaWX
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\lila_launcher.exe
WizardStyle=modern

[Files]
Source: "{#SourceDir}\lila_launcher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\lila_launcher.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\lila_launcher.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le bureau"; GroupDescription: "Raccourcis"; Flags: unchecked

[Run]
Filename: "{app}\lila_launcher.exe"; WorkingDir: "{app}"; Description: "Lancer {#AppName}"; Flags: nowait postinstall skipifsilent
