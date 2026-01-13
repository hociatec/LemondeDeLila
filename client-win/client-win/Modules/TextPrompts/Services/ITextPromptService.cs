using System.Threading.Tasks;
using System.Collections.Generic;

namespace client_win.Modules.TextPrompts.Services;

public interface ITextPromptService
{
    Task<string?> PromptAsync(string title, string label, string initialText);

    Task<Dictionary<string, string>?> PromptConfigAsync(
        string title,
        IReadOnlyList<(string Key, string Label, string InitialText)> fields);

    Task<(string Subject, string Message)?> PromptPrivateMessageAsync(
        string title,
        string subjectLabel,
        string messageLabel,
        string initialSubject,
        string initialMessage);
}
