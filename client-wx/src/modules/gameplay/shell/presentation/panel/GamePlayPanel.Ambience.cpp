#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::SetStartAmbienceSelectedHandler(StartAmbienceSelectedHandler handler)
{
    onStartAmbienceSelected_ = std::move(handler);
}

void GamePlayPanel::SetStartAmbiencePreviewHandler(StartAmbiencePreviewHandler handler)
{
    onStartAmbiencePreview_ = std::move(handler);
}

void GamePlayPanel::SetStartAmbienceVolumeHandler(StartAmbienceVolumeHandler handler)
{
    onStartAmbienceVolume_ = std::move(handler);
}

void GamePlayPanel::SetStartAmbiences(std::vector<std::pair<std::string, std::string>> ambiences)
{
    promptPanel_->SetStartAmbiences(std::move(ambiences));
}
}
