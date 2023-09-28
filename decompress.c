#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "test_image.h"

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

typedef struct HasSide {
	uint8_t left;
	uint8_t right;
} HasSide;

typedef struct DecodeNode {
	struct DecodeNode* left;
	struct DecodeNode* right;
	uint8_t hasByte;
	uint8_t byte;
} DecodeNode;

typedef struct DecodeNodeProcessing {
	HasSide* hasSideArray;
	DecodeNode* nodeArray;
	uint32_t nodeCurrentIndex;
	const uint8_t* data;
	uint32_t pos;
} DecodeNodeProcessing;

struct DecodeNode* processDecodeNode(DecodeNodeProcessing* state) {
	HasSide* hasSide = &state->hasSideArray[state->nodeCurrentIndex];
	DecodeNode* node = &state->nodeArray[state->nodeCurrentIndex];

	if (hasSide->left == 0 && hasSide->right == 0) {
		node->byte = state->data[state->pos++];
		node->hasByte = 1;
		return node;
	}

	node->hasByte = 0;

	if (hasSide->left == 1) {
		state->nodeCurrentIndex++;
		node->left = processDecodeNode(state);
	}

	if (hasSide->right == 1) {
		state->nodeCurrentIndex++;
		node->right = processDecodeNode(state);
	}

	return node;
}

typedef struct UnpackNodesFromRoot {
	DecodeNode* nodeArray;
	DecodeNode* rootNode;
	uint32_t pos;
} UnpackNodesFromRoot;

UnpackNodesFromRoot unpackNodesFromRoot(const uint8_t* data, uint32_t pos) {
	uint32_t totalNodes = (data[pos++]) + (data[pos++] << 8) +
	                      (data[pos++] << 16) + (data[pos++] << 24);

	HasSide hasSideArray[totalNodes];
	DecodeNode* nodeArray = malloc(totalNodes * sizeof(DecodeNode));

	uint32_t nodesRead = 0;

	uint8_t i = 0;

	while (nodesRead < totalNodes) {
		for (i = 0; i < 8; i += 2) {
			hasSideArray[nodesRead].left = (data[pos] >> (7 - i)) & 1;
			hasSideArray[nodesRead].right = (data[pos] >> (7 - i - 1)) & 1;

			nodesRead++;

			if (nodesRead >= totalNodes) break;
		}

		pos++;
	}

	// pos starts at byte array

	DecodeNodeProcessing decodeNodeProcessing;
	decodeNodeProcessing.hasSideArray = hasSideArray;
	decodeNodeProcessing.nodeArray = nodeArray;
	decodeNodeProcessing.nodeCurrentIndex = 0;
	decodeNodeProcessing.data = data;
	decodeNodeProcessing.pos = pos;

	DecodeNode* rootNode = processDecodeNode(&decodeNodeProcessing);

	// free(nodeArray) outside of function

	UnpackNodesFromRoot out;
	out.nodeArray = nodeArray;
	out.rootNode = rootNode;
	out.pos = decodeNodeProcessing.pos;

	return out;
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

typedef struct DataWithSize {
	const uint8_t* data;
	uint32_t size;
} DataWithSize;

// header (fixed length of 1 byte):
//
// [uint8: how many bits to ignore on last byte, since data is packed]
// [uint32: final decoded size]
//
// ...packed nodes from root
//
// ...packed data

DataWithSize huffmanDecode(DataWithSize data, uint32_t pos) {
	uint8_t bitsToIgnoreAtEnd = data.data[pos++];
	uint32_t decodedSize = (data.data[pos++]) + (data.data[pos++] << 8) +
	                       (data.data[pos++] << 16) + (data.data[pos++] << 24);

	UnpackNodesFromRoot nodesFromRoot = unpackNodesFromRoot(data.data, pos);
	pos = nodesFromRoot.pos;

	uint8_t bitPos = 0;

	uint8_t* decodedData = malloc(decodedSize);
	uint32_t decodedDataIndex = 0;

	DecodeNode* currentNode = nodesFromRoot.rootNode;

	while (pos < data.size - bitsToIgnoreAtEnd) {
		uint8_t bit = getNextBit(data.data, &pos, &bitPos);

		if (bit == 0) {
			currentNode = currentNode->left;
		} else if (bit == 1) {
			currentNode = currentNode->right;
		}

		if (currentNode->hasByte) {
			decodedData[decodedDataIndex++] = currentNode->byte;
			currentNode = nodesFromRoot.rootNode;
		}
	}

	free(nodesFromRoot.nodeArray);

	DataWithSize out;
	out.data = decodedData;
	out.size = decodedSize;

	return out;
}

// running huffman encoding multiple times compresses down really well
// so keep encoding until at smallest and then append rounds to file
//
// [uint8: rounds]
//
// ...packed

DataWithSize makiHuffmanDecode(DataWithSize data) {
	uint32_t pos = 0;

	uint8_t rounds = data.data[pos++];

	for (uint8_t i = 0; i < rounds; i++) {
		data = huffmanDecode(data, pos);
		pos = 0;
	}

	return data;
}

int main() {
	DataWithSize dataWithSize;
	dataWithSize.data = test_image;
	dataWithSize.size = sizeof(test_image);

	DataWithSize decodedData = makiHuffmanDecode(dataWithSize);

	// DataWithSize decodedData = huffmanDecode(test_image, 0);

	FILE* file = fopen("test-output.png", "w");
	fwrite(decodedData.data, 1, decodedData.size, file);

	free((void*)decodedData.data);

	return 0;
}