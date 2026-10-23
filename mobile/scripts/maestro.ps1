# Runs the Maestro flows in mobile/.maestro on the phone connected over USB.
# Maestro needs Java 17+; the portable Temurin 17 and Maestro CLI live in %LOCALAPPDATA%\Programs
# (the system Java 8 stays as it is). Usage, from mobile/:  powershell -File scripts/maestro.ps1 [flow.yaml]
param([string]$Flow = ".maestro")

$programs = "$env:LOCALAPPDATA\Programs"
$jdk = Get-ChildItem "$programs\temurin" -Directory -Filter "jdk-17*" | Select-Object -First 1
if (-not $jdk) { Write-Error "Temurin 17 not found in $programs\temurin"; exit 1 }
$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($jdk.FullName)\bin;$programs\maestro-cli\maestro\bin;$env:LOCALAPPDATA\Android\platform-tools;$env:Path"

# the phone reaches Metro and the local services through the cable
foreach ($port in 8081, 4000, 3100) { adb reverse "tcp:$port" "tcp:$port" | Out-Null }

maestro test $Flow
exit $LASTEXITCODE
