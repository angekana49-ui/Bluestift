# DRAFT voice-over: Windows' built-in speech voices, one WAV per script line.
#
# Placeholder only — it exists so the timeline, captions and pacing can be built
# and judged before the real voices are chosen. The two speakers are relayed as
# script.json says; the draft uses Zira (US) and Hazel (UK) because they are the
# two English voices every Windows install ships. Replace the files in
# public/voice/ with the final recordings (same names), then `npm run manifest`.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$script = Get-Content (Join-Path $root "src\script.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$outDir = Join-Path $root "public\voice"
New-Item -ItemType Directory -Force $outDir | Out-Null

$installed = (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

foreach ($scene in $script.scenes) {
  $i = 0
  foreach ($line in $scene.lines) {
    $voiceName = $script.voices.($line.speaker).draft
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($installed -contains $voiceName) { $synth.SelectVoice($voiceName) }
    # A touch quicker than default reads as brighter without clipping words.
    $synth.Rate = 1
    $file = Join-Path $outDir ("{0}-{1}.wav" -f $scene.id, $i)
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToWaveFile($file, $format)
    $synth.Speak($line.text)
    $synth.SetOutputToNull()
    $synth.Dispose()
    Write-Output ("voice {0}-{1} ({2})" -f $scene.id, $i, $line.speaker)
    $i++
  }
}
