using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace client_win.Core.Text;

public static class MojibakeTextRepair
{
    private static readonly object Gate = new();
    private static bool _enabled;
    public static event Action<bool>? EnabledChanged;

    private static readonly (Regex Pattern, string Replacement)[] Replacements =
    [
        (new Regex("ÃƒÂ", RegexOptions.Compiled), "Ã"),
        (new Regex("Ã€", RegexOptions.Compiled), "À"),
        (new Regex("Ã‚", RegexOptions.Compiled), "Â"),
        (new Regex("Ã„", RegexOptions.Compiled), "Ä"),
        (new Regex("Ã‡", RegexOptions.Compiled), "Ç"),
        (new Regex("Ãˆ", RegexOptions.Compiled), "È"),
        (new Regex("Ã‰", RegexOptions.Compiled), "É"),
        (new Regex("ÃŠ", RegexOptions.Compiled), "Ê"),
        (new Regex("Ã‹", RegexOptions.Compiled), "Ë"),
        (new Regex("ÃŽ", RegexOptions.Compiled), "Î"),
        (new Regex("ÃÏ", RegexOptions.Compiled), "Ï"),
        (new Regex("Ã”", RegexOptions.Compiled), "Ô"),
        (new Regex("Ã–", RegexOptions.Compiled), "Ö"),
        (new Regex("Ã™", RegexOptions.Compiled), "Ù"),
        (new Regex("Ã›", RegexOptions.Compiled), "Û"),
        (new Regex("Ãœ", RegexOptions.Compiled), "Ü"),
        (new Regex("ÃŸ", RegexOptions.Compiled), "ß"),
        (new Regex("Ã ", RegexOptions.Compiled), "à"),
        (new Regex("Ã¡", RegexOptions.Compiled), "á"),
        (new Regex("Ã¢", RegexOptions.Compiled), "â"),
        (new Regex("Ã¤", RegexOptions.Compiled), "ä"),
        (new Regex("Ã§", RegexOptions.Compiled), "ç"),
        (new Regex("Ã¨", RegexOptions.Compiled), "è"),
        (new Regex("Ã©", RegexOptions.Compiled), "é"),
        (new Regex("Ãª", RegexOptions.Compiled), "ê"),
        (new Regex("Ã«", RegexOptions.Compiled), "ë"),
        (new Regex("Ã¬", RegexOptions.Compiled), "ì"),
        (new Regex("Ã­", RegexOptions.Compiled), "í"),
        (new Regex("Ã®", RegexOptions.Compiled), "î"),
        (new Regex("Ã¯", RegexOptions.Compiled), "ï"),
        (new Regex("Ã²", RegexOptions.Compiled), "ò"),
        (new Regex("Ã³", RegexOptions.Compiled), "ó"),
        (new Regex("Ã´", RegexOptions.Compiled), "ô"),
        (new Regex("Ã¶", RegexOptions.Compiled), "ö"),
        (new Regex("Ã¹", RegexOptions.Compiled), "ù"),
        (new Regex("Ãº", RegexOptions.Compiled), "ú"),
        (new Regex("Ã»", RegexOptions.Compiled), "û"),
        (new Regex("Ã¼", RegexOptions.Compiled), "ü"),
        (new Regex("Å“", RegexOptions.Compiled), "œ"),
        (new Regex("Å’", RegexOptions.Compiled), "Œ"),
        (new Regex("â€™", RegexOptions.Compiled), "’"),
        (new Regex("â€˜", RegexOptions.Compiled), "‘"),
        (new Regex("â€œ", RegexOptions.Compiled), "“"),
        (new Regex("â€\u009d", RegexOptions.Compiled), "”"),
        (new Regex("â€“", RegexOptions.Compiled), "–"),
        (new Regex("â€”", RegexOptions.Compiled), "—"),
        (new Regex("â€¦", RegexOptions.Compiled), "…"),
        (new Regex("â€¢", RegexOptions.Compiled), "•"),
        (new Regex("Â ", RegexOptions.Compiled), " "),
        (new Regex("Â(?=[,;:.!?])", RegexOptions.Compiled), string.Empty),
    ];

    private static readonly (Regex Pattern, string Replacement)[] PhraseReplacements =
    [
        (new Regex(@"\bmise\s+a\s+jour\b", RegexOptions.Compiled | RegexOptions.IgnoreCase), "mise à jour"),
        (new Regex(@"\bmises\s+a\s+jour\b", RegexOptions.Compiled | RegexOptions.IgnoreCase), "mises à jour"),
        (new Regex(@"\ba\s+l'?echeance\b", RegexOptions.Compiled | RegexOptions.IgnoreCase), "à l'échéance"),
    ];

    private static readonly Regex WordRegex = new(@"\b[0-9A-Za-z][0-9A-Za-z'-]*\b", RegexOptions.Compiled);
    private static readonly Dictionary<string, string> WordReplacements = new(StringComparer.Ordinal)
    {
        ["acces"] = "accès",
        ["annulee"] = "annulée",
        ["annulees"] = "annulées",
        ["categorie"] = "catégorie",
        ["categories"] = "catégories",
        ["connecte"] = "connecté",
        ["connectes"] = "connectés",
        ["deconnecte"] = "déconnecté",
        ["deconnectes"] = "déconnectés",
        ["delai"] = "délai",
        ["delais"] = "délais",
        ["echeance"] = "échéance",
        ["echeances"] = "échéances",
        ["ecran"] = "écran",
        ["ecrans"] = "écrans",
        ["entree"] = "entrée",
        ["entrees"] = "entrées",
        ["etagere"] = "étagère",
        ["etageres"] = "étagères",
        ["etre"] = "être",
        ["etres"] = "êtres",
        ["fermee"] = "fermée",
        ["fermees"] = "fermées",
        ["forcage"] = "forçage",
        ["general"] = "général",
        ["immediat"] = "immédiat",
        ["immediatement"] = "immédiatement",
        ["immediates"] = "immédiates",
        ["modere"] = "modéré",
        ["parametre"] = "paramètre",
        ["parametres"] = "paramètres",
        ["redemarrage"] = "redémarrage",
        ["regle"] = "réglé",
        ["regler"] = "régler",
        ["reouverture"] = "réouverture",
        ["requis"] = "requis",
        ["requise"] = "requise",
        ["resume"] = "résumé",
        ["sauvegarde"] = "sauvegardé",
        ["terminee"] = "terminée",
        ["tres"] = "très",
    };

    public static bool IsEnabled
    {
        get
        {
            lock (Gate)
            {
                return _enabled;
            }
        }
    }

    public static void SetEnabled(bool enabled)
    {
        var changed = false;
        lock (Gate)
        {
            if (_enabled != enabled)
            {
                changed = true;
            }
            _enabled = enabled;
        }

        if (changed)
        {
            try
            {
                EnabledChanged?.Invoke(enabled);
            }
            catch
            {
                // best-effort
            }
        }
    }

    public static string Fix(string? value)
    {
        var input = value ?? string.Empty;
        if (!IsEnabled || input.Length == 0)
        {
            return input;
        }

        var best = input;
        if (LooksSuspicious(input))
        {
            var currentScore = Score(input);
            var targeted = ApplyTargetedReplacements(input);
            var targetedScore = Score(targeted);

            best = targetedScore < currentScore ? targeted : input;
            var bestScore = Math.Min(currentScore, targetedScore);

            foreach (var candidate in BuildCandidates(input, targeted))
            {
                var normalized = ApplyTargetedReplacements(candidate);
                var normalizedScore = Score(normalized);
                if (normalizedScore < bestScore)
                {
                    best = normalized;
                    bestScore = normalizedScore;
                    continue;
                }

                var score = Score(candidate);
                if (score < bestScore)
                {
                    best = candidate;
                    bestScore = score;
                }
            }
        }

        if (IsLossyAccentTransform(input, best))
        {
            best = input;
        }
        var normalizedFrench = ApplyFrenchReplacements(best);
        if (normalizedFrench.Length == 0)
        {
            return best;
        }
        if (IsLossyAccentTransform(best, normalizedFrench))
        {
            return best;
        }
        return normalizedFrench;
    }

    private static IEnumerable<string> BuildCandidates(string original, string targeted)
    {
        var utf8 = Encoding.UTF8;
        var latin1 = Encoding.Latin1;

        var one = utf8.GetString(latin1.GetBytes(original));
        if (!string.IsNullOrWhiteSpace(one))
        {
            yield return one;
        }

        var two = utf8.GetString(Windows1252Bytes(original));
        if (!string.IsNullOrWhiteSpace(two))
        {
            yield return two;
        }

        var three = utf8.GetString(latin1.GetBytes(targeted));
        if (!string.IsNullOrWhiteSpace(three))
        {
            yield return three;
        }

        var four = utf8.GetString(Windows1252Bytes(targeted));
        if (!string.IsNullOrWhiteSpace(four))
        {
            yield return four;
        }
    }

    private static byte[] Windows1252Bytes(string input)
    {
        var map = new Dictionary<int, byte>
        {
            [0x20AC] = 0x80,
            [0x201A] = 0x82,
            [0x0192] = 0x83,
            [0x201E] = 0x84,
            [0x2026] = 0x85,
            [0x2020] = 0x86,
            [0x2021] = 0x87,
            [0x02C6] = 0x88,
            [0x2030] = 0x89,
            [0x0160] = 0x8A,
            [0x2039] = 0x8B,
            [0x0152] = 0x8C,
            [0x017D] = 0x8E,
            [0x2018] = 0x91,
            [0x2019] = 0x92,
            [0x201C] = 0x93,
            [0x201D] = 0x94,
            [0x2022] = 0x95,
            [0x2013] = 0x96,
            [0x2014] = 0x97,
            [0x02DC] = 0x98,
            [0x2122] = 0x99,
            [0x0161] = 0x9A,
            [0x203A] = 0x9B,
            [0x0153] = 0x9C,
            [0x017E] = 0x9E,
            [0x0178] = 0x9F,
        };

        var bytes = new List<byte>(input.Length);
        foreach (var ch in input)
        {
            var cp = ch;
            if (cp <= 0xFF)
            {
                bytes.Add((byte)cp);
            }
            else if (map.TryGetValue(cp, out var mapped))
            {
                bytes.Add(mapped);
            }
            else
            {
                bytes.Add((byte)'?');
            }
        }

        return bytes.ToArray();
    }

    private static string ApplyTargetedReplacements(string value)
    {
        var output = value;
        foreach (var (pattern, replacement) in Replacements)
        {
            output = pattern.Replace(output, replacement);
        }
        return output;
    }

    private static string ApplyFrenchReplacements(string value)
    {
        var output = value;
        foreach (var (pattern, replacement) in PhraseReplacements)
        {
            output = pattern.Replace(output, m => MatchCase(replacement, m.Value));
        }

        output = WordRegex.Replace(output, match =>
        {
            var token = match.Value;
            if (token.Length <= 1)
            {
                return token;
            }

            var lower = token.ToLowerInvariant();
            if (!WordReplacements.TryGetValue(lower, out var replacement))
            {
                return token;
            }

            return MatchCase(replacement, token);
        });

        return output;
    }

    private static string MatchCase(string replacement, string source)
    {
        if (source.Length == 0 || replacement.Length == 0)
        {
            return replacement;
        }

        var isAllUpper = source.ToUpperInvariant() == source;
        if (isAllUpper)
        {
            return replacement.ToUpperInvariant();
        }

        if (char.IsUpper(source[0]))
        {
            var chars = replacement.ToCharArray();
            chars[0] = char.ToUpperInvariant(chars[0]);
            return new string(chars);
        }

        return replacement;
    }

    private static int Score(string value)
    {
        var suspicious = Regex.Matches(value, "[ÂÃâÅœœ]").Count;
        var replacement = value.IndexOf('�') >= 0 ? 1 : 0;
        return suspicious * 2 + replacement * 10;
    }

    private static bool LooksSuspicious(string value)
    {
        return value.IndexOf('Ã') >= 0 ||
               value.IndexOf('Â') >= 0 ||
               value.IndexOf("â", StringComparison.Ordinal) >= 0 ||
               value.IndexOf('�') >= 0;
    }
    private static bool IsLossyAccentTransform(string before, string after)
    {
        if (before.Length == 0 || after.Length == 0)
        {
            return false;
        }

        var beforeAccents = CountNonAsciiLetters(before);
        if (beforeAccents == 0)
        {
            return false;
        }

        return CountNonAsciiLetters(after) < beforeAccents;
    }

    private static int CountNonAsciiLetters(string value)
    {
        var count = 0;
        foreach (var ch in value)
        {
            if (ch > 0x7F && char.IsLetter(ch))
            {
                count++;
            }
        }

        return count;
    }
}
