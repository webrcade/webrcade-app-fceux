#include <emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/bind.h>

#include "em.h"
#include "../../fceu.h"
#include "../../ines.h"

bool FCEUD_ShouldDrawInputAids()
{
	return false;
}
 
void FCEUD_SetPalette(uint8 index, uint8 r, uint8 g, uint8 b)
{
    EM_ASM({
        window.emulator.setPaletteColor($0, $1, $2, $3);
    }, index, r, g, b);
} 

void FCEUD_GetPalette(uint8 index, uint8 *r, uint8 *g, uint8 *b)
{
}

bool FCEUI_AviEnableHUDrecording()
{
	return false;
}

void FCEUI_SetAviEnableHUDrecording(bool enable)
{
}

bool FCEUI_AviDisableMovieMessages()
{
	return false;
}

void FCEUI_SetAviDisableMovieMessages(bool disable)
{
}

void FCEUD_VideoChanged()
{
    Audio_UpdateSoundRate();
}

static void Video_SetSystem(const std::string& videoSystem)
{
    if (videoSystem == "auto") {
        FCEUI_SetVidSystem(iNESDetectVidSys()); // Attempt auto-detection.
    } else if (videoSystem == "ntsc") {
        FCEUI_SetVidSystem(0);
    } else if (videoSystem == "pal") {
        FCEUI_SetVidSystem(1);
    } else {
        FCEU_PrintError("Invalid video system: '%s'", videoSystem.c_str());
        return;
    }

    em_video_system = videoSystem;

    if (!GameInfo) {
        // Required if a game was not loaded.
        FCEUD_VideoChanged();
    }
}

bool Video_SetConfig(const std::string& key, const emscripten::val& value)
{
    if (key == "video-system") {
        Video_SetSystem(value.as<std::string>());
    } else {
        return false;
    }
    return true;
}

void BlitScreen(uint8 *XBuf)
{    
    EM_ASM({
        window.emulator.drawScreen($0);
    }, XBuf);
}
