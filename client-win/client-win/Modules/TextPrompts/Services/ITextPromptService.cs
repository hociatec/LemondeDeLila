using System.Threading.Tasks;

namespace client_win.Modules.TextPrompts.Services;

public interface ITextPromptService
{
    Task<string?> PromptAsync(string title, string label, string initialText);
}

