; ============================================================
;  Inno Setup Script: installer.iss
;  Empaqueta dist\win-unpacked en un instalador con icono .ico
; ============================================================

; ------- Parámetros (pueden sobreescribirse con /DCLAVE=valor) -------
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

#ifndef SourceDir
  ; Carpeta generada por: npx electron-builder --win --dir
  #define SourceDir "dist\\win-unpacked"
#endif

#ifndef AppName
  #define AppName "DeepSeek Chat"
#endif

#ifndef AppExe
  ; Cambiar si tu .exe tiene otro nombre
  #define AppExe "DeepSeek Chat.exe"
#endif

#ifndef AppIcon
  ; Icono .ico ya convertido desde resources\icono.png
  #define AppIcon "resources\\icono.ico"
#endif

; -------------------- SETUP --------------------
[Setup]
AppId={{F9D1F4A4-2D3A-4C2B-8C3E-9E8C9F8F4B1A}}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
; Icono del instalador (ventana + archivo setup)
SetupIconFile={#AppIcon}
; Icono que mostrará el desinstalador en "Programas y características"
UninstallDisplayIcon={app}\resources\icono.ico
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=installer
OutputBaseFilename={#AppName}_Setup_{#AppVersion}
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
; Para instalar en Program Files con elevación: PrivilegesRequired=admin

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

; -------------------- ARCHIVOS --------------------
[Files]
; Contenido generado por electron-builder --dir
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Copiamos el icono .ico a la app (para accesos directos y desinstalador)
Source: "{#AppIcon}"; DestDir: "{app}\resources"; Flags: ignoreversion

; -------------------- ACCESOS DIRECTOS --------------------
[Icons]
; Menú inicio
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\resources\icono.ico"
; Escritorio (opcional, por tarea)
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon; IconFilename: "{app}\resources\icono.ico"

; -------------------- POST INSTALACIÓN --------------------
[Run]
Filename: "{app}\{#AppExe}"; Description: "Ejecutar {#AppName}"; Flags: nowait postinstall skipifsilent
