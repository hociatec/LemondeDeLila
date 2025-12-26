using System;
using System.Linq;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.ViewModels;

internal static class GamePlayPendingTextBuilder
{
    internal static string Build(GamePendingDto? pending)
    {
        if (pending == null || string.IsNullOrWhiteSpace(pending.Type))
        {
            return string.Empty;
        }

        var question = string.IsNullOrWhiteSpace(pending.Question) ? null : pending.Question.Trim();
        if (pending.Choices != null && pending.Choices.Count > 0)
        {
            var choices = string.Join(", ", pending.Choices.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()));
            if (!string.IsNullOrWhiteSpace(question))
            {
                return $"{question} (choix: {choices})";
            }
            return $"En attente: {pending.Type} (choix: {choices})";
        }

        return !string.IsNullOrWhiteSpace(question)
            ? question
            : $"En attente: {pending.Type}";
    }
}
