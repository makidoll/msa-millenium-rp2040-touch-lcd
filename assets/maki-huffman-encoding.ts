type FrequencyMap = Map<number, number>; // byte, frequency

function getFrequencyMap(data: Uint8Array): FrequencyMap {
	const map: FrequencyMap = new Map();

	for (const byte of data) {
		const value = map.get(byte);
		if (value == null) {
			map.set(byte, 1);
		} else {
			map.set(byte, value + 1);
		}
	}

	return map;
}

type Bit = 0 | 1; // left | right

interface HuffNode {
	left?: HuffNode;
	right?: HuffNode;
	parent?: HuffNode;
	parentSide?: Bit;
	byte?: number;
	freq: number;
}

function frequencyMapToNodes(freqs: FrequencyMap): {
	byteNodes: HuffNode[];
	rootNode: HuffNode;
} {
	const byteNodes: HuffNode[] = Array.from(freqs.entries()).map(
		([byte, freq]) => ({ byte, freq }),
	);

	// new array but keep references
	let topLevelNodes = new Array(byteNodes.length)
		.fill(null)
		.map((_, i) => byteNodes[i]);

	while (true) {
		if (topLevelNodes.length == 1) break;

		let lowestA: HuffNode = { freq: Infinity };
		let lowestB: HuffNode = { freq: Infinity };

		for (const node of topLevelNodes) {
			if (node.freq < lowestA.freq) {
				lowestA = node;
			}
		}

		for (const node of topLevelNodes) {
			if (node.freq < lowestB.freq && node != lowestA) {
				lowestB = node;
			}
		}

		lowestA.parentSide = 0;
		lowestB.parentSide = 1;

		const newNode: HuffNode = {
			left: lowestA,
			right: lowestB,
			freq: lowestA.freq + lowestB.freq,
		};

		lowestA.parent = newNode;
		lowestB.parent = newNode;

		topLevelNodes.splice(topLevelNodes.indexOf(lowestA), 1);
		topLevelNodes.splice(topLevelNodes.indexOf(lowestB), 1);
		topLevelNodes.push(newNode);
	}

	const rootNode = topLevelNodes[0];

	return { byteNodes, rootNode };
}

function encodeData(byteNodes: HuffNode[], data: Uint8Array) {
	let allBits: boolean[] = [];

	for (const byte of data) {
		let seq: string[] = [];

		let currentNode: HuffNode | undefined = byteNodes.find(
			n => n.byte == byte,
		);

		if (currentNode == null) {
			throw new Error("Node with char not found");
		}

		while (currentNode.parent != null) {
			seq.push(String(currentNode.parentSide));
			currentNode = currentNode?.parent;
		}

		const bits = seq.reverse().map(bit => (bit === "0" ? false : true));

		allBits.push(...bits);
	}

	return allBits;
}

// const MAX_UINT8 = 255;
// const MAX_UINT16 = 65535;
// const MAX_UINT32 = 4294967295;

function uintXto8(x: 16 | 32, value: number): number[] {
	const tempA = x == 16 ? new Uint16Array(1) : new Uint32Array(1);
	tempA[0] = value;

	const tempB = new Uint8Array(
		tempA.buffer,
		tempA.byteOffset,
		tempA.byteLength,
	);

	return Array.from(tempB);
}

// to pack root node:
//
// [uint32 total nodes]
//
// for each node use pack bits to store info
// 0/1 => has left
// 0/1 => has right
// if left and right are both 0, there's a byte
//
// ...pack the above into uint8 array. total nodes is array size
//
// ...array of [uint8: byte]
// no eof needed cause we can calculate size above

function chunk<T>(array: T[], size: number) {
	return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
		array.slice(i * size, i * size + size),
	);
}

interface SerializedNodes {
	nodeArray: { left: boolean; right: boolean }[];
	byteArray: number[];
}

function packNode(node: HuffNode, serializedNodes: SerializedNodes) {
	serializedNodes.nodeArray.push({ left: !!node.left, right: !!node.right });

	if (node.left == null && node.right == null) {
		serializedNodes.byteArray.push(node.byte as any);
		return;
	}

	if (node.left != null) {
		packNode(node.left, serializedNodes);
	}

	if (node.right != null) {
		packNode(node.right, serializedNodes);
	}
}

function packNodesFromRoot(rootNode: HuffNode) {
	const serializedNodes: SerializedNodes = {
		nodeArray: [],
		byteArray: [],
	};

	packNode(rootNode, serializedNodes);

	const packedNodeArray = chunk(
		serializedNodes.nodeArray
			.map(node => (node.left ? "1" : "0") + (node.right ? "1" : "0"))
			.join("")
			.split(""),
		8,
	).map(bits => parseInt(bits.join("").padEnd(8, "0"), 2));

	let pos = 0;
	const finalPacked = new Uint8Array(
		4 + packedNodeArray.length + serializedNodes.byteArray.length,
	);

	const totalNodesUint8 = uintXto8(32, serializedNodes.nodeArray.length);
	finalPacked[pos++] = totalNodesUint8[0];
	finalPacked[pos++] = totalNodesUint8[1];
	finalPacked[pos++] = totalNodesUint8[2];
	finalPacked[pos++] = totalNodesUint8[3];

	for (const packedHasSize of packedNodeArray) {
		finalPacked[pos++] = packedHasSize;
	}

	for (const byte of serializedNodes.byteArray) {
		finalPacked[pos++] = byte;
	}

	return finalPacked;
}

function packEncodedData(data: boolean[]) {
	let packed = new Uint8Array(Math.ceil(data.length / 8));
	let pos = 0;

	for (let i = 0; i < data.length; i += 8) {
		const bits = data
			.slice(i, i + 8)
			.map(b => (b === true ? "1" : "0"))
			.join("")
			.padEnd(8, "0");

		packed[pos] = parseInt(bits, 2);
		pos++;
	}

	return { data: packed, bitsToIgnoreAtEnd: packed.length * 8 - data.length };
}

// header (fixed length of 1 byte):
//
// [uint8: how many bits to ignore on last byte, since data is packed]
// [uint32: final decoded size]
//
// ...packed nodes from root
//
// ...packed data

function huffmanEncode(data: Uint8Array) {
	const frequencyMap = getFrequencyMap(data);
	const { byteNodes, rootNode } = frequencyMapToNodes(frequencyMap);

	const packedNodesFromRoot = packNodesFromRoot(rootNode);

	const encodedData = encodeData(byteNodes, data);
	const packedEncodedData = packEncodedData(encodedData);

	let pos = 0;
	const packedFinal = new Uint8Array(
		1 + 4 + packedNodesFromRoot.length + packedEncodedData.data.length,
	);

	packedFinal[pos++] = packedEncodedData.bitsToIgnoreAtEnd;

	const finalDecodedSize = uintXto8(32, data.length);
	packedFinal[pos++] = finalDecodedSize[0];
	packedFinal[pos++] = finalDecodedSize[1];
	packedFinal[pos++] = finalDecodedSize[2];
	packedFinal[pos++] = finalDecodedSize[3];

	for (const byte of packedNodesFromRoot) {
		packedFinal[pos++] = byte;
	}

	for (const byte of packedEncodedData.data) {
		packedFinal[pos++] = byte;
	}

	return packedFinal;
}

function uint16ToNumber(uint16: Uint8Array) {
	return new Uint16Array(uint16.buffer, 0, 1)[0];
}

function uint32ToNumber(uint32: Uint8Array) {
	return new Uint32Array(uint32.buffer, 0, 1)[0];
}

interface DecodeNode {
	left?: DecodeNode;
	right?: DecodeNode;
	byte?: number;
}

function unpackNodesFromRoot(data: Uint8Array, pos: number) {
	const totalNodes = uint32ToNumber(data.slice(pos, pos + 4));
	pos += 4;

	const hasSideArray: { left: boolean; right: boolean }[] = [];
	let nodesRead = 0;

	while (nodesRead < totalNodes) {
		const byte = data[pos++].toString(2).padStart(8, "0");

		for (let i = 0; i < 4; i++) {
			const hasSides = byte.slice(i * 2, i * 2 + 2).split("");

			hasSideArray.push({
				left: hasSides[0] == "1",
				right: hasSides[1] == "1",
			});

			nodesRead++;

			if (nodesRead >= totalNodes) break;
		}
	}

	// pos starts at byte array

	let hasSideCurrentIndex = 0;

	function processHasSide(): DecodeNode {
		const hasSide = hasSideArray[hasSideCurrentIndex];

		if (hasSide.left == false && hasSide.right == false) {
			return { byte: data[pos++] };
		}

		const node: DecodeNode = {};

		if (hasSide.left) {
			hasSideCurrentIndex++;
			node.left = processHasSide();
		}

		if (hasSide.right) {
			hasSideCurrentIndex++;
			node.right = processHasSide();
		}

		return node;
	}

	const rootNode = processHasSide();

	return { rootNode, pos };
}

function huffmanDecode(data: Uint8Array) {
	let pos = 0;

	const bitsToIgnoreAtEnd = data[pos++];

	const decodedSize = uint32ToNumber(data.slice(pos, pos + 4));
	pos += 4;

	// unpack nodes from root

	const unpackedNodes = unpackNodesFromRoot(data, pos);
	const rootNode = unpackedNodes.rootNode;
	pos = unpackedNodes.pos;

	// unpack encoded data

	let bitPos = 0;

	function getNextBit() {
		if (bitPos > 7) {
			bitPos = 0;
			pos++;
		}
		return data[pos].toString(2).padStart(8, "0")[bitPos++];
	}

	const decodedData = new Uint8Array(decodedSize);
	let decodedDataIndex = 0;

	let currentNode: DecodeNode = rootNode;

	while (pos < data.length - bitsToIgnoreAtEnd) {
		const bit = getNextBit();

		if (bit == "0") {
			currentNode = currentNode.left as any;
		} else if (bit == "1") {
			currentNode = currentNode.right as any;
		}

		if (currentNode.byte != null) {
			decodedData[decodedDataIndex++] = currentNode.byte;
			currentNode = rootNode;
		}
	}

	return decodedData;
}

// running huffman encoding multiple times compresses down really well
// so keep encoding until at smallest and then append rounds to file
//
// [uint8: rounds]
//
// ...packed

export function makiHuffmanEncode(data: Uint8Array) {
	let rounds = 0;
	let currentData: Uint8Array = data;

	while (true) {
		const newData = huffmanEncode(currentData);
		if (newData.length > currentData.length) break;
		currentData = newData;
		rounds++;
	}

	if (rounds == 0) {
		throw new Error("Can't compress even once");
	}

	const finalData = new Uint8Array(1 + currentData.length);

	finalData[0] = rounds;

	for (let i = 0; i < currentData.length; i++) {
		finalData[1 + i] = currentData[i];
	}

	return finalData;
}

export function makiHuffmanDecode(data: Uint8Array) {
	const rounds = data[0];

	let currentData = data.slice(1, data.length);

	for (let i = 0; i < rounds; i++) {
		currentData = huffmanDecode(currentData);
	}

	return currentData;
}

// const testInput = await Deno.readFile("./test-input.png");
// console.log(testInput.length / 1000 + " KB");

// let testEncoded = makiHuffmanEncode(testInput);
// console.log(testEncoded.length / 1000 + " KB");

// await Deno.writeFile("./test-compressed.raw", testEncoded);

// // let testDecoded = makiHuffmanDecode(testEncoded);

// // await Deno.writeFile("./test-output.png", testDecoded);

// const cOut = `
// #ifndef TEST_IMAGE
// #define TEST_IMAGE
// const unsigned char test_image[${testEncoded.length}] = {${Array.from(
// 	testEncoded,
// ).join(",")}};
// #endif
// `;

// await Deno.writeTextFile("./test_image.h", cOut.trim() + "\n");
