#include "modules/home/application/HomeAuthValidator.h"

#include <cctype>
#include <regex>

#include "shared/text/StringUtils.h"

namespace
{
bool IsValidUsername(const std::string& username)
{
    static const std::regex pattern("^[a-zA-Z0-9_\\-]+$");
    return std::regex_match(username, pattern);
}

bool ContainsLetterAndDigit(const std::string& password)
{
    bool hasLetter = false;
    bool hasDigit = false;

    for (char c : password)
    {
        if (std::isalpha(static_cast<unsigned char>(c)) != 0)
        {
            hasLetter = true;
        }
        else if (std::isdigit(static_cast<unsigned char>(c)) != 0)
        {
            hasDigit = true;
        }
    }

    return hasLetter && hasDigit;
}
}

namespace lila::modules::home::application
{
std::optional<std::string> HomeAuthValidator::ValidateLogin(
    const std::string& username,
    const std::string& password)
{
    const auto normalizedUsername = shared::text::TrimCopy(username);

    if (normalizedUsername.empty())
    {
        return "Le nom d'utilisateur est requis.";
    }

    if (password.empty())
    {
        return "Le mot de passe est requis.";
    }

    return std::nullopt;
}

std::optional<std::string> HomeAuthValidator::ValidateRegistration(
    const std::string& username,
    const std::string& email,
    const std::string& password)
{
    const auto normalizedUsername = shared::text::TrimCopy(username);
    const auto normalizedEmail = shared::text::TrimCopy(email);

    if (normalizedUsername.size() < 3)
    {
        return "Le nom d'utilisateur doit contenir au moins 3 caractères.";
    }

    if (normalizedUsername.size() > 30 || !IsValidUsername(normalizedUsername))
    {
        return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets (-) et underscores (_).";
    }

    if (normalizedEmail.empty() || normalizedEmail.find('@') == std::string::npos)
    {
        return "L'adresse email n'est pas valide.";
    }

    if (password.size() < 8 || !ContainsLetterAndDigit(password))
    {
        return "Le mot de passe doit contenir au moins 8 caractères avec une lettre et un chiffre.";
    }

    return std::nullopt;
}
}
