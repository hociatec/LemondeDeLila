using System;
using System.Globalization;
using System.Text.Json;

namespace client_win.Modules.Game.Play.Common;

internal static class JsonPayloadReader
{
    internal static string? TryReadString(JsonElement payload, string propertyName)
    {
        if (!payload.TryGetProperty(propertyName, out var node))
        {
            return null;
        }

        if (node.ValueKind == JsonValueKind.String)
        {
            return node.GetString();
        }

        if (node.ValueKind == JsonValueKind.Number)
        {
            if (node.TryGetInt32(out var asInt))
            {
                return asInt.ToString();
            }

            if (node.TryGetDouble(out var asDouble) && double.IsFinite(asDouble))
            {
                return asDouble.ToString(CultureInfo.InvariantCulture);
            }
        }

        return null;
    }

    internal static bool TryReadInt(JsonElement payload, string propertyName, out int value)
    {
        value = 0;
        if (!payload.TryGetProperty(propertyName, out var node))
        {
            return false;
        }

        if (node.ValueKind == JsonValueKind.Number)
        {
            if (node.TryGetInt32(out value))
            {
                return true;
            }

            if (node.TryGetDouble(out var asDouble) && double.IsFinite(asDouble))
            {
                value = (int)Math.Round(asDouble);
                return true;
            }
        }

        if (node.ValueKind == JsonValueKind.String)
        {
            var raw = node.GetString();
            if (int.TryParse(raw, out value))
            {
                return true;
            }
        }

        return false;
    }
}
