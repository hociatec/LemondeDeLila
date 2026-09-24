param(
    [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$clientRoot = Split-Path -Parent $PSScriptRoot
$bassLibrary = Join-Path $clientRoot 'third_party/bass/bin/x64/bass.dll'
$escapedLibrary = $bassLibrary.Replace('"', '""')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class LilaAudioAudit {
    [DllImport(@"$escapedLibrary")]
    public static extern bool BASS_Init(int device, uint frequency, uint flags, IntPtr window, IntPtr guid);
    [DllImport(@"$escapedLibrary")]
    public static extern bool BASS_Free();
    [DllImport(@"$escapedLibrary", CharSet=CharSet.Unicode)]
    static extern uint BASS_StreamCreateFile(int memory, string file, ulong offset, ulong length, uint flags);
    [DllImport(@"$escapedLibrary")]
    static extern int BASS_ChannelGetData(uint channel, [Out] float[] buffer, uint length);
    [DllImport(@"$escapedLibrary")]
    static extern bool BASS_StreamFree(uint stream);
    [DllImport(@"$escapedLibrary")]
    static extern int BASS_ErrorGetCode();
    public static double[] Decode(string file) {
        // Decode only: never open a speaker device or play the sound.
        uint stream = BASS_StreamCreateFile(0, file, 0, 0, 0x80200100u);
        if (stream == 0) throw new Exception("BASS load error " + BASS_ErrorGetCode());
        try {
            var buffer = new float[16384];
            long count = 0;
            double peak = 0, energy = 0;
            while (true) {
                int bytes = BASS_ChannelGetData(stream, buffer, (uint)(buffer.Length * 4));
                if (bytes < 0) {
                    if (BASS_ErrorGetCode() != 45) throw new Exception("BASS decode error " + BASS_ErrorGetCode());
                    break;
                }
                if (bytes == 0) break;
                for (int i = 0; i < bytes / 4; i++) {
                    if (float.IsNaN(buffer[i]) || float.IsInfinity(buffer[i])) throw new Exception("Invalid audio sample");
                    peak = Math.Max(peak, Math.Abs(buffer[i]));
                    energy += (double)buffer[i] * buffer[i];
                    count++;
                }
            }
            if (count == 0 || peak == 0) throw new Exception("Empty or entirely silent audio");
            return new double[] { count, peak, Math.Sqrt(energy / count) };
        } finally { BASS_StreamFree(stream); }
    }
}
"@
$files = @(
    Get-ChildItem -LiteralPath (Join-Path $clientRoot 'resources/sounds') -Filter '*.wav'
    Get-ChildItem -LiteralPath (Join-Path $env:TEMP 'lila-audio-audit') -Filter '*.wav'
)
if (![LilaAudioAudit]::BASS_Init(0, 44100, 0, [IntPtr]::Zero, [IntPtr]::Zero)) {
    throw 'Cannot initialize BASS silent device for audit.'
}
try {
$results = @($files | ForEach-Object {
    $audioFile = $_
    try {
        $audio = [LilaAudioAudit]::Decode($audioFile.FullName)
        [pscustomobject]@{ file = $audioFile.Name; samples = $audio[0]; peak = $audio[1]; rms = $audio[2]; error = $null }
    } catch {
        [pscustomobject]@{ file = $audioFile.Name; error = $_.Exception.Message }
    }
})
} finally { [void][LilaAudioAudit]::BASS_Free() }
$results | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$failed = @($results | Where-Object { $_.error })
Write-Output "BASS: $($results.Count) files, $($failed.Count) failures. Report: $OutputPath"
if ($failed.Count -gt 0) { $failed | Format-Table; exit 1 }
