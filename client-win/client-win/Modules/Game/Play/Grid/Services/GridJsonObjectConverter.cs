using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace client_win.Modules.Game.Play.Grid.Services;

internal static class GridJsonObjectConverter
{
    internal static object? ToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Undefined => null,
            JsonValueKind.Null => null,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.TryGetDouble(out var d) ? d : null,
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Array => element.EnumerateArray().Select(ToObject).ToList(),
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => ToObject(p.Value), StringComparer.Ordinal),
            _ => null,
        };
    }
}

