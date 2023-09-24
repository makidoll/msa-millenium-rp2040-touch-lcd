#ifndef MAKI_GAME_OF_LIFE_SCREEN
#define MAKI_GAME_OF_LIFE_SCREEN

#include <stdbool.h>
#include <stdint.h>
#include "../color.h"

// copied from https://github.com/makidrone/c-things

// cant do 240 cause i run out of memory. should optimize

#define GOL_WIDTH 120
#define GOL_HEIGHT 120
// #define GOL_SIZE GOL_WIDTH * GOL_HEIGHT
#define GOL_SCALE 2

typedef struct {
	bool cells[GOL_HEIGHT][GOL_WIDTH];
	bool pre_cells[GOL_HEIGHT][GOL_WIDTH];
} GameOfLifeScreenState;

void GameOfLifeAddRpentomino(GameOfLifeScreenState* state, int y, int x) {
	state->cells[y][x+1] = 1;
	state->cells[y][x+2] = 1;
	state->cells[y+1][x] = 1;
	state->cells[y+1][x+1] = 1;
	state->cells[y+2][x+1] = 1;
}

void GameOfLifeAddGlider(GameOfLifeScreenState* state, int y, int x) {
	state->cells[y][x+1] = 1;
	state->cells[y+1][x+2] = 1;
	state->cells[y+2][x] = 1;
	state->cells[y+2][x+1] = 1;
	state->cells[y+2][x+2] = 1;
}

void InitGameOfLifeScreenState(GameOfLifeScreenState* state) {
	for (int y = 0; y < GOL_HEIGHT; y++) {
		for (int x = 0; x < GOL_WIDTH; x++) {
			state->cells[y][x] = false;
			state->pre_cells[y][x] = false;
		}
	}

	GameOfLifeAddRpentomino(state, GOL_HEIGHT/2-2, GOL_WIDTH/2-2);
	// GameOfLifeAddGlider(state, 0, 0);
}

int GameOfLifeGetPreNeighbours(GameOfLifeScreenState* state, int yy, int xx) {
	int neighbours = 0;

	for (int y=-1; y<2; y++) {
		for (int x=-1; x<2; x++) {
			if (
				(y != 0 || x != 0) &&
				(xx+x > -1 && xx+x < GOL_WIDTH) &&
				(yy+y > -1 && yy+y < GOL_HEIGHT)
			) {
				if (state->pre_cells[yy+y][xx+x]) ++neighbours;
			}
		}
	}

	return neighbours;
}

void GameOfLifePixelRaw(uint16_t x, uint16_t y, bool show, uint16_t* buffer) {
	uint16_t color = show ? 0xffff : 0x0000;
	buffer[y * 240 + x] = color;
}

void GameOfLifePixel(uint16_t x, uint16_t y, bool show, uint16_t* buffer) {
	GameOfLifePixelRaw(x * 2, y * 2, show, buffer);
	GameOfLifePixelRaw(x * 2 + 1, y * 2, show, buffer);
	GameOfLifePixelRaw(x * 2, y * 2 + 1, show, buffer);
	GameOfLifePixelRaw(x * 2 + 1, y * 2 + 1, show, buffer);
}

bool GameOfLifeScreen(GameOfLifeScreenState* state, uint16_t* buffer, bool redraw) {
	// draw

	for (uint16_t y=0; y < GOL_HEIGHT; y++) {
		for (uint16_t x=0; x < GOL_WIDTH; x++) {
			GameOfLifePixel(x, y, state->cells[y][x], buffer);
		}
	}

	// update pre_cells

	for (uint16_t y=0; y<GOL_HEIGHT; y++) {
		for (uint16_t x=0; x<GOL_WIDTH; x++) {
			state->pre_cells[y][x] = state->cells[y][x];
		}
	}

	// evaluate pre_cells into cells

	for (uint16_t y=0; y<GOL_HEIGHT; y++) {
		for (uint16_t x=0; x<GOL_WIDTH; x++) {
			int n = GameOfLifeGetPreNeighbours(state, y, x);
			if (state->pre_cells[y][x]) {
				// alive
				if (n < 2 || n > 3) state->cells[y][x] = 0;
			} else {
				// dead
				if (n == 3) state->cells[y][x] = 1;
			}
		}
	}

	return true;
}

#endif