using System;
using System.Linq;
using System.Text.Json;

namespace client_win.Core.Network;

public static class ApiErrorParser
{
    public static string? TryExtractMessage(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!doc.RootElement.TryGetProperty("message", out var message))
            {
                return null;
            }

            return message.ValueKind switch
            {
                JsonValueKind.String => message.GetString(),
                JsonValueKind.Array => string.Join(
                    " ",
                    message.EnumerateArray()
                        .Where(e => e.ValueKind == JsonValueKind.String)
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }
}

