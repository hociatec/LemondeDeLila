#include "modules/about/presentation/AboutFrame.h"
#include <wx/app.h>
#include <wx/button.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::about::presentation
{
void AboutFrame::SendContact()
{
    if (sendingContact_) return;
    auto text = contactMessageCtrl_->GetValue();
    text.Trim(true).Trim(false);
    if (text.empty())
    {
        UpdateStatus(L"Veuillez saisir un message.");
        lila::shared::accessibility::NavigationController::Focus(contactMessageCtrl_);
        return;
    }
    // Match the backend's JavaScript UTF-16 length, including emoji.
    std::size_t length = 0;
    for (const auto character : text) length += character.GetValue() > 0xFFFF ? 2 : 1;
    if (length > 2000)
    {
        UpdateStatus(L"Le message ne doit pas d\u00E9passer 2 000 caract\u00E8res.");
        lila::shared::accessibility::NavigationController::Focus(contactMessageCtrl_);
        return;
    }
    sendingContact_ = true;
    contactMessageCtrl_->SetEditable(false);
    sendContactButton_->Disable();
    UpdateStatus(L"Envoi du message en cours...");
    contactRequest_.Cancel();
    const auto generation = contactRequest_.CurrentToken();
    auto* sender = &contactSender_;
    wxWeakRef<AboutFrame> weakThis(this);
    // Resolve the weak window reference only on the UI thread.
    auto task = lila::shared::concurrency::RunAsync<bool>(
        [sender, message = lila::shared::text::ToUtf8(text)](std::stop_token stopToken)
        {
            sender->Send(message, stopToken);
            return true;
        },
        [weakThis, generation](std::optional<lila::shared::errors::AppError> error,
                               std::optional<bool> sent)
        {
            wxTheApp->CallAfter([weakThis, generation, error, sent]()
            {
                if (!weakThis || !weakThis->contactRequest_.Complete(generation)) return;
                weakThis->sendingContact_ = false;
                weakThis->contactMessageCtrl_->SetEditable(true);
                weakThis->sendContactButton_->Enable();
                if (error || !sent.value_or(false))
                {
                    weakThis->UpdateStatus(error
                        ? lila::shared::text::FromUtf8(error->UserMessage())
                        : wxString(L"Impossible d'envoyer le message au staff."));
                    return;
                }
                weakThis->contactMessageCtrl_->Clear();
                weakThis->UpdateStatus(L"Votre message a \u00E9t\u00E9 envoy\u00E9 au staff.");
            });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Impossible d'envoyer le message au staff.");
    if (!task->WasAccepted())
    {
        sendingContact_ = false;
        contactMessageCtrl_->SetEditable(true);
        sendContactButton_->Enable();
        UpdateStatus(L"Envoi indisponible pour le moment. Veuillez r\u00E9essayer.");
        return;
    }
    contactRequest_.Track(std::move(task));
}
}
