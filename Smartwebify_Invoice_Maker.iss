; Smartwebify Invoice Maker - Inno Setup script
; This script assumes you've run: npm run pack:win
; which creates the unpacked app inside: dist/win-unpacked

#define MyAppName "Smartwebify Invoice Maker"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Smartwebify"
#define MyAppExeName "Smartwebify Invoice Maker.exe"

[Setup]
AppId={{B6984A6E-9B6F-4E45-8C41-5C30A7E2A8A9}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=no
OutputBaseFilename=Smartwebify-Invoice-Maker-Setup
Compression=lzma
SolidCompression=yes
RestartIfNeededByRun=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french";  MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Copy everything from Electron's win-unpacked output
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
