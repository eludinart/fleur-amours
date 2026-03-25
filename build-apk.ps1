# ============================================================
# build-apk.ps1 — Génère l'APK debug de Fleur d'AmOurs
# ============================================================
# Prérequis (à installer une seule fois) :
#   1. JDK 21  → https://adoptium.net/  (Temurin 21 LTS)
#   2. Android Studio → https://developer.android.com/studio
#      Après installation : SDK Manager → Android SDK → SDK Tools
#      Cocher : Android SDK Build-Tools, Android SDK Platform-Tools
#
# Variables d'environnement nécessaires :
#   ANDROID_HOME = C:\Users\<vous>\AppData\Local\Android\Sdk
#   JAVA_HOME    = C:\Program Files\Eclipse Adoptium\jdk-21...
# ============================================================

param(
    [string]$ApiUrl    = "",         # URL de l'app (ex. https://www.eludein.art/jardin ou https://app-fleurdamours.eludein.art/jardin)
    [string]$ServerUrl = "",         # CAP_SERVER_URL pour Capacitor (optionnel)
    [switch]$Release   = $false,     # Build Release (signé) vs Debug
    [switch]$SkipBuild = $false      # Sauter le build React (si déjà à jour)
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Fleur d'AmOurs — Build APK ===" -ForegroundColor Cyan

# ── 1. Auto-détection Java (JBR Android Studio ou JAVA_HOME) ─
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not $env:JAVA_HOME) {
    if (Test-Path "$studioJbr\bin\java.exe") {
        $env:JAVA_HOME = $studioJbr
        Write-Host "[AUTO] JAVA_HOME = $studioJbr (JBR Android Studio)" -ForegroundColor Gray
    } else {
        Write-Host "[ERREUR] Java non trouvé. Installer JDK 21 : https://adoptium.net/" -ForegroundColor Red
        exit 1
    }
}
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$javaVersion = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Select-Object -First 1
Write-Host "[OK] Java : $javaVersion" -ForegroundColor Green

# ── Auto-détection Android SDK ────────────────────────────────
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    $autoSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $autoSdk) {
        $env:ANDROID_HOME = $autoSdk
        Write-Host "[AUTO] ANDROID_HOME = $autoSdk" -ForegroundColor Gray
    } else {
        Write-Host "[ERREUR] ANDROID_HOME non défini." -ForegroundColor Red
        exit 1
    }
}
Write-Host "[OK] ANDROID_HOME = $env:ANDROID_HOME" -ForegroundColor Green

# ── 2. Config APK (charge l'app depuis l'URL serveur) ───────────
$appUrl = if ($ApiUrl) { $ApiUrl } elseif ($ServerUrl) { $ServerUrl } else { "https://www.eludein.art/jardin" }
$env:CAP_SERVER_URL = $appUrl

if (-not $SkipBuild) {
    Write-Host "`n[1/4] Configuration APK..." -ForegroundColor Cyan
    Write-Host "  CAP_SERVER_URL = $appUrl (l'APK charge l'app depuis le serveur)" -ForegroundColor Gray
    Write-Host "[OK] Config prête" -ForegroundColor Green
} else {
    Write-Host "[SKIP] Config (--SkipBuild activé)" -ForegroundColor Gray
}

# ── 3. Sync Capacitor ─────────────────────────────────────────
Write-Host "`n[2/4] Sync Capacitor..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "[ERREUR] cap sync échoué" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Sync Capacitor terminé" -ForegroundColor Green

# ── 4. Build Gradle ───────────────────────────────────────────
Write-Host "`n[3/4] Build Gradle (APK)..." -ForegroundColor Cyan
Push-Location android

$buildTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
& ".\gradlew.bat" $buildTask --no-daemon

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Build Gradle échoué" -ForegroundColor Red
    Pop-Location; exit 1
}
Pop-Location

# ── 5. Copier l'APK ──────────────────────────────────────────
Write-Host "`n[4/4] Récupération de l'APK..." -ForegroundColor Cyan

$buildType  = if ($Release) { "release" } else { "debug" }
$apkName    = if ($Release) { "app-release-unsigned.apk" } else { "app-debug.apk" }
$apkSource  = "android\app\build\outputs\apk\$buildType\$apkName"
$apkDest    = "FleurAmOurs-$(Get-Date -Format 'yyyyMMdd-HHmm')-$buildType.apk"

if (Test-Path $apkSource) {
    Copy-Item $apkSource $apkDest
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host " APK généré : $apkDest" -ForegroundColor Green
    Write-Host " Taille     : $([math]::Round((Get-Item $apkDest).Length / 1MB, 1)) MB" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    Write-Host " → Transférer sur téléphone via USB ou e-mail" -ForegroundColor Cyan
    Write-Host " → Activer 'Sources inconnues' sur Android pour installer" -ForegroundColor Cyan
    Write-Host " → Paramètres → Sécurité → Installer apps inconnues`n" -ForegroundColor Cyan
} else {
    Write-Host "[ERREUR] APK introuvable : $apkSource" -ForegroundColor Red
    exit 1
}
