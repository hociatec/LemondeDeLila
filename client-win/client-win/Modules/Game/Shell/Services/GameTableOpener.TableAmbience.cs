using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Network;

namespace client_win.Modules.Game.Shell.Services;

public sealed partial class GameTableOpener
{
    private sealed class TableAmbienceFileDto
    {
        public TableAmbienceItemDto[]? Items { get; set; }
    }

    private sealed class TableAmbienceItemDto
    {
        public string? SoundId { get; set; }
        public string? Name { get; set; }
        public bool? Enabled { get; set; }
    }

    public void InvalidateTableAmbienceLabelsCache()
    {
        lock (_tableAmbienceLabelsCacheGate)
        {
            _tableAmbienceLabelsCache = null;
            _tableAmbienceLabelsCacheUntil = DateTimeOffset.MinValue;
            _tableAmbienceLabelsInFlight = null;
        }
    }

    private async Task<Dictionary<string, string>> FetchTableAmbienceLabelsAsync(CancellationToken cancellationToken)
    {
        Dictionary<string, string>? cached = null;
        Task<Dictionary<string, string>>? inFlight = null;
        lock (_tableAmbienceLabelsCacheGate)
        {
            if (_tableAmbienceLabelsCache != null && DateTimeOffset.UtcNow < _tableAmbienceLabelsCacheUntil)
            {
                cached = new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }
            else if (_tableAmbienceLabelsInFlight != null)
            {
                inFlight = _tableAmbienceLabelsInFlight;
            }
            else
            {
                _tableAmbienceLabelsInFlight = FetchTableAmbienceLabelsCoreAsync(cancellationToken);
                inFlight = _tableAmbienceLabelsInFlight;
            }
        }

        if (cached != null)
        {
            return cached;
        }

        var fetched = await (inFlight ?? FetchTableAmbienceLabelsCoreAsync(cancellationToken)).ConfigureAwait(false);
        lock (_tableAmbienceLabelsCacheGate)
        {
            if (ReferenceEquals(_tableAmbienceLabelsInFlight, inFlight))
            {
                _tableAmbienceLabelsInFlight = null;
            }

            if (fetched.Count > 0)
            {
                _tableAmbienceLabelsCache = new Dictionary<string, string>(fetched, StringComparer.OrdinalIgnoreCase);
                _tableAmbienceLabelsCacheUntil = DateTimeOffset.UtcNow.AddMinutes(2);
                return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }

            if (_tableAmbienceLabelsCache != null)
            {
                return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
            }

            _tableAmbienceLabelsCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            _tableAmbienceLabelsCacheUntil = DateTimeOffset.UtcNow.AddSeconds(20);
            return new Dictionary<string, string>(_tableAmbienceLabelsCache, StringComparer.OrdinalIgnoreCase);
        }
    }

    private async Task<Dictionary<string, string>> FetchTableAmbienceLabelsCoreAsync(CancellationToken cancellationToken)
    {
        try
        {
            var endpoint = new Uri(_config.HttpBase, "sounds/table-ambiences");
            using var req = new HttpRequestMessage(HttpMethod.Get, endpoint);
            using var res = await HttpClientProvider.Shared
                .SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var json = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var dto = JsonSerializer.Deserialize<TableAmbienceFileDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            var items = dto?.Items ?? Array.Empty<TableAmbienceItemDto>();

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var it in items)
            {
                if (it?.Enabled == false)
                {
                    continue;
                }
                var id = (it?.SoundId ?? string.Empty).Trim();
                var name = (it?.Name ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }
                map[id] = name;
            }
            return map;
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
