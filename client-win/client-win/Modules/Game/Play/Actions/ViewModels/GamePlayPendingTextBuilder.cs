using System;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Actions.ViewModels;

internal static class GamePlayPendingTextBuilder
{
    internal static string Build(GamePendingDto? pending)
    {
        if (pending == null || string.IsNullOrWhiteSpace(pending.Type))
        {
            return string.Empty;
        }

        var type = pending.Type.Trim();
        if (type.StartsWith("lama_", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        var label = string.IsNullOrWhiteSpace(pending.Label) ? null : pending.Label.Trim();
        if (!string.IsNullOrWhiteSpace(label))
        {
            return label;
        }

        var question = string.IsNullOrWhiteSpace(pending.Question) ? null : pending.Question.Trim();
        if (!string.IsNullOrWhiteSpace(question))
        {
            return question;
        }

        return $"En attente: {pending.Type}";
    }
}
