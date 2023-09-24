#ifndef MAKI_PROFILE_PICTURE_SCREEN
#define MAKI_PROFILE_PICTURE_SCREEN

#include <stdbool.h>
#include <stdint.h>
#include "../images/maki_image.h"

bool MakiProfilePictureScreen(uint16_t* buffer, bool redraw) {
	if (redraw) {
		for (uint16_t i = 0; i < 240 * 240; i++) {
			buffer[i] = maki_image[i];
		}

		return true;
	}

	return false;
}

#endif