using System.Threading.Tasks;

namespace client_win.Modules.TextPrompts.Services;

public interface ISecretPromptService
{
    Task<string?> PromptSecretAsync(string title, string label);
}

