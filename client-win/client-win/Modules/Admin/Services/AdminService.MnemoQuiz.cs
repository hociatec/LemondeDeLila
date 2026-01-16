using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminMnemoQuizCategoriesResponseDto> GetMnemoQuizCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizCategoriesResponseDto>(
            WsMessageTypes.Admin.MnemoQuizCategories,
            payload: new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement catégories quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizCategoriesResponseDto> CreateMnemoQuizCategoryAsync(string name, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizCategoriesResponseDto>(
            WsMessageTypes.Admin.MnemoQuizCategoryCreate,
            new { name },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Création catégorie quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizCategoriesResponseDto> UpdateMnemoQuizCategoryAsync(string id, string name, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizCategoriesResponseDto>(
            WsMessageTypes.Admin.MnemoQuizCategoryUpdate,
            new { id, name },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour catégorie quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizCategoriesResponseDto> DeleteMnemoQuizCategoryAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizCategoriesResponseDto>(
            WsMessageTypes.Admin.MnemoQuizCategoryDelete,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression catégorie quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizQuestionsResponseDto> GetMnemoQuizQuestionsAsync(string? categoryId = null, string? status = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizQuestionsResponseDto>(
            WsMessageTypes.Admin.MnemoQuizQuestions,
            new { categoryId, status },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement questions quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizQuestionsResponseDto> CreateMnemoQuizQuestionAsync(string categoryId, string question, IEnumerable<string> answers, int correctIndex = 0, string? status = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var answersList = (answers ?? Array.Empty<string>()).Select(s => s?.Trim() ?? string.Empty).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
        var response = await _ws.RequestAsync<AdminMnemoQuizQuestionsResponseDto>(
            WsMessageTypes.Admin.MnemoQuizQuestionCreate,
            new { categoryId, question, answers = answersList, correctIndex, status },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Création question quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizQuestionsResponseDto> UpdateMnemoQuizQuestionAsync(string id, string? question = null, IEnumerable<string>? answers = null, int? correctIndex = null, string? status = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var answersList = answers == null
            ? null
            : answers.Select(s => s?.Trim() ?? string.Empty).Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
        var response = await _ws.RequestAsync<AdminMnemoQuizQuestionsResponseDto>(
            WsMessageTypes.Admin.MnemoQuizQuestionUpdate,
            new { id, question, answers = answersList, correctIndex, status },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour question quiz impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminMnemoQuizQuestionsResponseDto> DeleteMnemoQuizQuestionAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminMnemoQuizQuestionsResponseDto>(
            WsMessageTypes.Admin.MnemoQuizQuestionDelete,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression question quiz impossible.");
        }
        return response.Payload;
    }
}

