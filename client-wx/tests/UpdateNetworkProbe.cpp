#include <iostream>
#include <string>
#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

int main(int argc, char** argv)
{
    if (argc != 2 && argc != 4) return 2;
    try
    {
        if (argc == 4)
            lila::modules::update::launcher::DownloadFile(argv[1], argv[2], std::stoull(argv[3]));
        else
            std::cout << lila::modules::update::launcher::DownloadText(argv[1]);
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what();
        return 1;
    }
}
