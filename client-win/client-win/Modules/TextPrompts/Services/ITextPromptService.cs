using System.Threading.Tasks;

namespace client_win.Modules.TextPrompts.Services;

public interface ITextPromptService
{
    Task<string?> PromptAsync(string title, string label, string initialText);

    Task<(string Subject, string Message)?> PromptPrivateMessageAsync(
        string title,
        string subjectLabel,
        string messageLabel,
        string initialSubject,
        string initialMessage);
}
