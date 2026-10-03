$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$demoVideoDirectory = $PSScriptRoot
$demoScenes = Get-Content -LiteralPath (Join-Path $demoVideoDirectory 'scenes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$demoAudioDirectory = Join-Path $demoVideoDirectory '.runtime/audio'
New-Item -ItemType Directory -Force -Path $demoAudioDirectory | Out-Null
$demoNarrator = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $demoNarrator.SelectVoice('Microsoft Zira Desktop')
    $demoNarrator.Rate = 1
    for ($demoSceneIndex = 0; $demoSceneIndex -lt $demoScenes.Count; $demoSceneIndex++) {
        $demoAudioPath = Join-Path $demoAudioDirectory ('{0:D2}.wav' -f $demoSceneIndex)
        $demoNarrator.SetOutputToWaveFile($demoAudioPath)
        $demoNarrator.Speak($demoScenes[$demoSceneIndex].narration)
        $demoNarrator.SetOutputToNull()
    }
} finally {
    $demoNarrator.Dispose()
}
Write-Output "Generated narration for $($demoScenes.Count) scenes."
