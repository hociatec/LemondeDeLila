#pragma once

#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::shared::errors
{
inline std::string PresentedErrorMessage(
    const nlohmann::json& payload,
    std::string_view fallback)
{
    if (!payload.is_object()) return std::string(fallback);

    for (const char* field : {"message", "error"})
    {
        const auto value = payload.find(field);
        if (value != payload.end() && value->is_string() &&
            !value->get_ref<const std::string&>().empty())
            return value->get<std::string>();
    }

    const auto codeValue = payload.find("code");
    if (codeValue == payload.end() || !codeValue->is_string())
        return std::string(fallback);
    const auto& code = codeValue->get_ref<const std::string&>();

    if (code == "GAME_ROOM_NOT_FOUND") return "La table n'est plus disponible.";
    if (code == "GAME_PAYLOAD_VALIDATION") return "Les donn\xC3\xA9""es envoy\xC3\xA9""es sont invalides.";
    if (code == "GAME_CONTENT_VALIDATION") return "Le contenu du jeu est invalide.";
    if (code == "GAME_ACTION_REJECTED") return "Cette action n'est pas disponible.";
    if (code == "GAME_UNKNOWN_ACTION") return "Action de jeu inconnue.";
    if (code == "GAME_ACTOR_REQUIRED") return "Cette action requiert un joueur actif.";
    if (code == "GAME_TURN_VIOLATION") return "Ce n'est pas votre tour.";
    if (code == "GAME_CONFIGURATION_ERROR") return "La configuration du jeu est invalide.";
    if (code == "GAME_STATE_VIOLATION") return "L'\xC3\xA9""tat de la partie est invalide.";
    if (code == "GAME_STATE_CONFLICT") return "La partie a chang\xC3\xA9""; actualisez puis r\xC3\xA9""essayez.";
    if (code == "GAME_NOT_FOUND") return "\xC3\x89""l\xC3\xA9""ment de jeu introuvable.";
    if (code == "GAME_RULE_VIOLATION" || code.starts_with("UNKNOWN_") ||
        code.starts_with("STALE_") || code.starts_with("QUIZ_") ||
        code.starts_with("SUBMISSION_") || code.starts_with("VOTE_") ||
        code.starts_with("CARD_") || code.starts_with("PAWN_") ||
        code.starts_with("PLAYER_") || code.starts_with("INSUFFICIENT_"))
        return "R\xC3\xA8""gle de jeu non respect\xC3\xA9""e.";
    if (code == "GAME_ROOM_LOCK_UNAVAILABLE")
        return "La table est occup\xC3\xA9""e; r\xC3\xA9""essayez dans un instant.";
    if (code == "ROOM_WS_INVALID_MESSAGE") return "Message de table invalide.";
    if (code == "ROOM_WS_UNKNOWN_COMMAND") return "Commande de table inconnue.";

    return std::string(fallback);
}
}
