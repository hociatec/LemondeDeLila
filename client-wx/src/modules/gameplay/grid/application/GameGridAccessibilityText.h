#pragma once

#include <cstddef>
#include <string>

namespace lila::modules::gameplay::application::grid
{
inline std::string GameGridAccessibilityText(std::size_t boardCount)
{
    std::string text = "Grille de jeu. Flèches pour naviguer.";
    if (boardCount > 1)
        text += " Page précédente ou suivante pour changer de plateau.";
    text += " Entrée pour jouer quand une action est disponible.";
    return text;
}
}
