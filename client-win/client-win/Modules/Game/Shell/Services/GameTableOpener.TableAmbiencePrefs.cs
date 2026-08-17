using System;
using client_win.Modules.Settings.Models;

namespace client_win.Modules.Game.Shell.Services;

public sealed partial class GameTableOpener
{
    private void TryApplyTableAmbiencePrefsForSnapshot(string? vaultSnapshotId)
    {
        var id = (vaultSnapshotId ?? string.Empty).Trim();
        if (id.Length == 0)
        {
            return;
        }

        try
        {
            var state = _options.Current;
            var map = state.TableAmbiencePrefsByVaultSnapshotId;
            if (map == null || !map.TryGetValue(id, out var prefs) || prefs == null)
            {
                return;
            }

            var nextEnabled = prefs.Enabled;
            var nextVolume = Math.Max(0, Math.Min(100, prefs.Volume));
            if (state.SoundTableAmbience == nextEnabled && state.SoundTableAmbienceVolume == nextVolume)
            {
                return;
            }

            state.SoundTableAmbience = nextEnabled;
            state.SoundTableAmbienceVolume = nextVolume;
            _options.Update(state);
        }
        catch
        {
            // best-effort
        }
    }

    private void TryPersistTableAmbiencePrefsForSnapshot(string? vaultSnapshotId)
    {
        var id = (vaultSnapshotId ?? string.Empty).Trim();
        if (id.Length == 0)
        {
            return;
        }

        try
        {
            var state = _options.Current;
            state.TableAmbiencePrefsByVaultSnapshotId ??= new();

            var enabled = state.SoundTableAmbience;
            var volume = Math.Max(0, Math.Min(100, state.SoundTableAmbienceVolume));
            state.TableAmbiencePrefsByVaultSnapshotId[id] = new OptionsState.TableAmbienceSnapshotPrefs
            {
                Enabled = enabled,
                Volume = volume
            };
            _options.Update(state);
        }
        catch
        {
            // best-effort
        }
    }
}
