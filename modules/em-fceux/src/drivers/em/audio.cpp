/* FCE Ultra - NES/Famicom Emulator - Emscripten audio
 *
 * Copyright notice for this file:
 *  Copyright (C) 2015 Valtteri "tsone" Heikkila
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */
#include "em.h"
#include "../../utils/memory.h"
#include "../../fceu.h"
#include <emscripten.h>

static float_t *sound_buffer = 0;

bool Audio_Init()
{
    if (sound_buffer) {
        return true;
    }

    sound_buffer = (float_t*) FCEU_dmalloc(sizeof(float_t) * AUDIO_BUF_MAX);
    if (!sound_buffer) {
        FCEUD_PrintError("Failed to create audio buffer.");
        return false;
    }
 
    FCEUI_SetSoundVolume(150); // Maximum volume.
    FCEUI_SetSoundQuality(0); // Low quality.
    FCEUI_SetLowPass(0);
    FCEUI_Sound(48000 + 90 /* Hack to elminate pops */);
    FCEUI_SetTriangleVolume(256);
    FCEUI_SetSquare1Volume(256);
    FCEUI_SetSquare2Volume(256);
    FCEUI_SetNoiseVolume(256);
    FCEUI_SetPCMVolume(256);
    return true;
}

void Audio_Write(int32 *buf, int count)
{
    for(int i = 0; i < count; i++) {
        sound_buffer[i] = buf[i] / (float)32768;
    }
}

extern "C" float_t* EMSCRIPTEN_KEEPALIVE Audio_GetBuffer(void) {
    return sound_buffer;
}