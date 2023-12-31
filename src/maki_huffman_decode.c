#include "maki_huffman_decode.h"

#include <stdio.h>
#include <stdlib.h>

void printBitsUint8(uint8_t num) {
	uint8_t mask = 0b10000000;
	for (uint8_t bit = 0; bit < 8; bit++) {
		printf("%u", (num & mask) > 0 ? (uint8_t)1 : (uint8_t)0);
		num <<= 1;
	}
	printf("\n");
}

void printBitsUint16(uint16_t num) {
	uint16_t mask = 0b1000000000000000;
	for (uint8_t bit = 0; bit < 16; bit++) {
		printf("%u", (num & mask) > 0 ? (uint16_t)1 : (uint16_t)0);
		num <<= 1;
	}
	printf("\n");
}

#define READ_UINT32(data, pos)                                    \
	((data[pos]) + (data[pos + 1] << 8) + (data[pos + 2] << 16) + \
	 (data[pos + 3] << 24));

#define READ_UINT32_MOVE_POS(data, pos)                         \
	((data[pos++]) + (data[pos++] << 8) + (data[pos++] << 16) + \
	 (data[pos++] << 24));

typedef struct DecodeNode {
	struct DecodeNode* left;
	struct DecodeNode* right;
	uint8_t hasByte;
	uint8_t byte;
} DecodeNode;

typedef struct DecodeNodeProcessing {
	DecodeNode* nodeArray;
	uint32_t nodeCurrentIndex;
	const uint8_t* data;
	uint32_t pos;
	uint32_t nodeArrayPos;
} DecodeNodeProcessing;

uint8_t getLeftRight(DecodeNodeProcessing* state, const uint32_t index,
                     const uint8_t needRight) {
	const uint32_t bytePos = state->nodeCurrentIndex / 4;
	const uint8_t bitPos =
	    (state->nodeCurrentIndex % 4) * 2 + (needRight);  // 0 left, 1 right

	return (state->data[state->nodeArrayPos + bytePos] >> (7 - bitPos)) & 1;
}

struct DecodeNode* processDecodeNode(DecodeNodeProcessing* state) {
	uint8_t hasLeft = getLeftRight(state, state->nodeCurrentIndex, 0);
	uint8_t hasRight = getLeftRight(state, state->nodeCurrentIndex, 1);

	DecodeNode* node = &state->nodeArray[state->nodeCurrentIndex];

	if (hasLeft == 0 && hasRight == 0) {
		node->byte = state->data[state->pos++];
		node->hasByte = 1;
		return node;
	}

	node->hasByte = 0;

	if (hasLeft == 1) {
		state->nodeCurrentIndex++;
		node->left = processDecodeNode(state);
	}

	if (hasRight == 1) {
		state->nodeCurrentIndex++;
		node->right = processDecodeNode(state);
	}

	return node;
}

uint8_t getNextBit(const uint8_t* data, uint32_t* pos, uint8_t* bitPos) {
	if (*bitPos > 7) {
		*bitPos = 0;
		*pos = *pos + 1;
	}

	uint8_t bit = (data[*pos] >> (7 - *bitPos)) & 1;

	*bitPos = *bitPos + 1;

	return bit;
}

// header (fixed length of 1 byte):
//
// [uint8: how many bits to ignore on last byte, since data is packed]
// [uint32: final decoded size]
//
// ...packed nodes from root
//
// ...packed data

uint32_t getDecodedSize(const uint8_t* data, uint32_t pos) {
	// ignore pos 0, bits to ignore
	return READ_UINT32(data, pos + 1);
}

void huffmanDecode(const uint8_t* data, uint32_t* size, uint32_t pos,
                   uint8_t* decodedData, const uint32_t decodedSize) {
	const uint8_t bitsToIgnoreAtEnd = data[pos++];

	pos += 4;  // decoded size;

	const uint32_t totalNodes = READ_UINT32_MOVE_POS(data, pos);

	// unpack node array

	DecodeNode nodeArray[totalNodes];

	// pos currently at node array

	DecodeNodeProcessing decodeNodeProcessing;
	decodeNodeProcessing.nodeArray = nodeArray;
	decodeNodeProcessing.nodeArrayPos = pos;

	// byte array is ceil(totalNodes / 4) away
	// since we're packing 4 nodes in a byte

	pos += (totalNodes / 4) + ((totalNodes % 4 > 0) ? 1 : 0);

	decodeNodeProcessing.nodeCurrentIndex = 0;
	decodeNodeProcessing.data = data;
	decodeNodeProcessing.pos = pos;

	DecodeNode* rootNode = processDecodeNode(&decodeNodeProcessing);
	pos = decodeNodeProcessing.pos;

	// unpack data

	uint8_t bitPos = 0;

	uint32_t decodedDataIndex = 0;

	DecodeNode* currentNode = rootNode;

	while (pos < *size) {
		if (pos == *size - 1 && bitPos > 7 - bitsToIgnoreAtEnd) break;

		uint8_t bit = getNextBit(data, &pos, &bitPos);

		if (bit == 0) {
			currentNode = currentNode->left;
		} else if (bit == 1) {
			currentNode = currentNode->right;
		}

		if (currentNode->hasByte) {
			decodedData[decodedDataIndex++] = currentNode->byte;
			currentNode = rootNode;
		}
	}
}

// running huffman encoding multiple times compresses down really well
// so keep encoding until at smallest and then append rounds to file
//
// [uint8: rounds]
//
// ...packed

uint8_t* makiHuffmanDecode(const uint8_t* data, uint32_t* size) {
	uint8_t pos = 0;  // only goes from 0 to 1 to 0 and stays

	const uint8_t rounds = data[pos++];
	printf("%u rounds\n", rounds);

	uint8_t* bufferA = (uint8_t*)data;
	uint8_t* bufferB = NULL;

	// mallocing a lot here but its getting free'd

	for (uint8_t i = 0; i < rounds; i++) {
		if (bufferB == NULL) {
			// decode A into B

			uint32_t decodedSize = getDecodedSize(bufferA, pos);
			bufferB = malloc(decodedSize);

			huffmanDecode(bufferA, size, pos, bufferB, decodedSize);

			if (pos == 0) free(bufferA);  // not initial
			pos = 0;

			bufferA = NULL;
		} else if (bufferA == NULL) {
			// decode B into A

			uint32_t decodedSize = getDecodedSize(bufferB, pos);
			bufferA = malloc(decodedSize);

			huffmanDecode(bufferB, size, pos, bufferA, decodedSize);

			if (pos == 0) free(bufferB);  // not initial
			// pos = 0; // only need to this for the initial A to B

			bufferB = NULL;
		}
	}

	// remember to free out of function

	return bufferA == NULL ? bufferB : bufferA;
}

// int main() {
// 	DataWithSize dataWithSize;
// 	dataWithSize.data = test_image;
// 	dataWithSize.size = sizeof(test_image);

// 	DataWithSize decodedData = makiHuffmanDecode(dataWithSize);

// 	// DataWithSize decodedData = huffmanDecode(test_image, 0);

// 	FILE* file = fopen("test-output.png", "w");
// 	fwrite(decodedData.data, 1, decodedData.size, file);

// 	free((void*)decodedData.data);

// 	return 0;
// }