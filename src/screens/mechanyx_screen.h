#ifndef MAKI_MECHANYX_SCREEN
#define MAKI_MECHANYX_SCREEN

#include <stdbool.h>
#include <stdint.h>
#include "../images/mechanyx_image.h"

bool MechanyxScreen(uint16_t* buffer, bool redraw) {
	if (redraw) {
		for (uint16_t i = 0; i < 240 * 240; i++) {
			buffer[i] = mechanyx_image[i];
		}

		return true;
	}

	return false;
}

#endif