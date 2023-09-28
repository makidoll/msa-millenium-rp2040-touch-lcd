#ifndef MAKI_PROFILE_PICTURE_SCREEN
#define MAKI_PROFILE_PICTURE_SCREEN

#include <stdbool.h>
#include <stdint.h>

#include "../images/maki_image.h"
#include "../maki_huffman_decode.h"

typedef struct {
	DataWithSize image;
} MakiProfilePictureScreenState;

void InitMakiProfilePictureScreenState(MakiProfilePictureScreenState* state) {
	DataWithSize input;
	input.data = maki_image;
	input.size = sizeof(maki_image);
	state->image = makiHuffmanDecode(input);
}

// TODO: free image for deinit

bool MakiProfilePictureScreen(MakiProfilePictureScreenState* state,
                              uint16_t* buffer, bool redraw) {
	if (redraw) {
		const uint8_t* data = state->image.data;
		for (uint16_t i = 0; i < 240 * 240; i++) {
			buffer[i] =
			    ((uint16_t)data[i * 2] << 8) | ((uint16_t)data[i * 2 + 1]);
		}

		return true;
	}

	return false;
}

#endif