#include "modules/home/presentation/HomeFrame.h"

#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "shared/config/AppConfig.h"

namespace
{
constexpr int WindowWidth = 1280;
constexpr int WindowHeight = 720;
}

namespace lila::modules::home::presentation
{
HomeFrame::HomeFrame(
    user::application::LoginUseCase& loginUseCase,
    user::application::RegisterUseCase& registerUseCase,
    LoginSucceededHandler onLoginSucceeded)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::FromUTF8(shared::config::AppConfig::AppTitle.data()),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE & ~wxRESIZE_BORDER & ~wxMAXIMIZE_BOX),
      loginUseCase_(loginUseCase),
      registerUseCase_(registerUseCase),
      onLoginSucceeded_(std::move(onLoginSucceeded))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();
    ShowPage(Page::Landing);
    CentreOnScreen();
}
}
