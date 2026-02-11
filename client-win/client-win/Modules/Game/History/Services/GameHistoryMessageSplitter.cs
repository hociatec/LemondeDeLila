using System;
using System.Collections.Generic;
using System.Linq;

namespace client_win.Modules.Game.History.Services;

internal static class GameHistoryMessageSplitter
{
    internal const string BlankLineToken = "\u00A0";

    public static IReadOnlyList<string> Split(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return Array.Empty<string>();
        }

        var normalized = message
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');

        var result = new List<string>();

        var lines = normalized.Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var rawLine = lines[i];
            var line = (rawLine ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(line))
            {
                // Keep blank separators only between non-empty content (drop leading/trailing empties).
                if (result.Count == 0)
                {
                    continue;
                }

                var hasNonEmptyAhead = false;
                for (var j = i + 1; j < lines.Length; j++)
                {
                    if (!string.IsNullOrWhiteSpace(lines[j]))
                    {
                        hasNonEmptyAhead = true;
                        break;
                    }
                }

                if (!hasNonEmptyAhead)
                {
                    continue;
                }

                if (!string.Equals(result[^1], BlankLineToken, StringComparison.Ordinal))
                {
                    result.Add(BlankLineToken);
                }
                continue;
            }

            foreach (var part in SplitLineIntoSentences(line))
            {
                var cleaned = (part ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(cleaned))
                {
                    result.Add(cleaned);
                }
            }
        }

        return result;
    }

    private static IEnumerable<string> SplitLineIntoSentences(string line)
    {
        if (string.IsNullOrWhiteSpace(line))
        {
            yield break;
        }

        var start = 0;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (!IsSentencePunctuation(c))
            {
                continue;
            }

            // Ellipse "..." : ne pas découper sur le 1er/2e point.
            if (c == '.' && ((i > 0 && line[i - 1] == '.') || (i + 1 < line.Length && line[i + 1] == '.')))
            {
                continue;
            }

            // On découpe uniquement si la ponctuation est suivie d'au moins un espace.
            if (i + 1 < line.Length && !char.IsWhiteSpace(line[i + 1]))
            {
                continue;
            }

            // Heuristique: éviter de découper sur des abréviations courtes ("M.", "Dr.", "Mme.").
            if (c == '.' && LooksLikeAbbreviation(line, i))
            {
                continue;
            }

            var nextNonSpaceIndex = PeekNextNonSpaceIndex(line, i + 1);
            if (nextNonSpaceIndex < 0)
            {
                continue;
            }

            var part = line.Substring(start, i - start + 1);
            if (!string.IsNullOrWhiteSpace(part))
            {
                yield return part;
            }

            start = nextNonSpaceIndex;
            i = start - 1;
        }

        if (start < line.Length)
        {
            var tail = line.Substring(start);
            if (!string.IsNullOrWhiteSpace(tail))
            {
                yield return tail;
            }
        }
    }

    private static bool IsSentencePunctuation(char c) =>
        c == '.' || c == '!' || c == '?' || c == '…';

    private static int PeekNextNonSpaceIndex(string s, int startIndex)
    {
        for (var i = startIndex; i < s.Length; i++)
        {
            if (!char.IsWhiteSpace(s[i]))
            {
                return i;
            }
        }
        return -1;
    }

    private static bool LooksLikeAbbreviation(string s, int punctuationIndex)
    {
        if (punctuationIndex <= 0)
        {
            return false;
        }

        var endExclusive = punctuationIndex;
        var start = endExclusive - 1;
        while (start >= 0 && char.IsLetter(s[start]))
        {
            start--;
        }
        start++;

        var token = s.Substring(start, endExclusive - start);
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        if (token.Length > 3)
        {
            return false;
        }

        if (!token.All(char.IsLetter))
        {
            return false;
        }

        return char.IsUpper(token[0]);
    }
}
