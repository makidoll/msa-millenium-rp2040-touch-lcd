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
	charNodes: HuffNode[];
	rootNode: HuffNode;
} {
	const charNodes: HuffNode[] = Array.from(freqs.entries()).map(
		([byte, freq]) => ({ byte, freq }),
	);

	// new array but keep references
	let topLevelNodes = new Array(charNodes.length)
		.fill(null)
		.map((_, i) => charNodes[i]);

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

	return { charNodes, rootNode };
}

function encodeData(frequencyMap: FrequencyMap, data: Uint8Array) {
	const { charNodes } = frequencyMapToNodes(frequencyMap);

	let allBits: boolean[] = [];

	for (const byte of data) {
		let seq: string[] = [];

		let currentNode: HuffNode | undefined = charNodes.find(
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

function decode(frequencyMap: FrequencyMap, encoded: boolean[]) {
	const { rootNode } = frequencyMapToNodes(frequencyMap);

	let bytes: number[] = [];

	let currentNode: HuffNode | undefined = rootNode;

	for (const bit of encoded) {
		currentNode = bit == false ? currentNode?.left : currentNode?.right;

		if (currentNode?.byte == null) {
			continue;
		}

		bytes.push(currentNode.byte);

		currentNode = rootNode;
	}

	return Uint8Array.from(bytes);
}

// our file format

// header (fixed length of 2 byte):
// [uint16: position to data]
// [uint8: how many bits to ignore on last byte, since data is packed]

// frequency map (array):
// [uint8: byte] [uint8: uint size: 1:8, 2:16, 3:32] [uint8/16/32: frequency]

// data (packed uint8 array)

const MAX_UINT8 = 255;
const MAX_UINT16 = 65535;
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

function packFrequencyMap(frequencyMap: FrequencyMap): Uint8Array {
	const encoded: number[] = [];

	for (const [byte, frequency] of frequencyMap.entries()) {
		encoded.push(byte);

		let freqUintSize = 1; // uint8

		if (frequency > MAX_UINT16) {
			freqUintSize = 3; // uint32
		} else if (frequency > MAX_UINT8) {
			freqUintSize = 2; // uint16
		}

		encoded.push(freqUintSize);

		if (freqUintSize == 1) {
			encoded.push(frequency);
		} else if (freqUintSize == 2) {
			encoded.push(...uintXto8(16, frequency));
		} else if (freqUintSize == 3) {
			encoded.push(...uintXto8(32, frequency));
		}
	}

	return Uint8Array.from(encoded);
}

function packEncodedData(data: boolean[]) {
	let packed = new Uint8Array(Math.ceil(data.length / 8));
	let pos = 0;

	for (let i = 0; i < data.length; i += 8) {
		const bits = data
			.slice(i, i + 8)
			.map(b => (b === true ? "1" : "0"))
			.join("")
			.padStart(8, "");

		packed[pos] = parseInt(bits, 2);
		pos++;
	}

	return { data: packed, bitsToIgnoreAtEnd: packed.length * 8 - data.length };
}

export function makiHuffmanEncode(data: Uint8Array) {
	const frequencyMap = getFrequencyMap(data);

	const encodedData = encodeData(frequencyMap, data);

	const packedFrequencyMap = packFrequencyMap(frequencyMap);
	const packedEncodedData = packEncodedData(encodedData);

	const packedFinal = new Uint8Array(
		3 + packedFrequencyMap.length + packedEncodedData.data.length,
	);

	const posToData = uintXto8(16, 3 + packedFrequencyMap.length);
	packedFinal[0] = posToData[0];
	packedFinal[1] = posToData[1];
	packedFinal[2] = packedEncodedData.bitsToIgnoreAtEnd;

	for (let i = 0; i < packedFrequencyMap.length; i++) {
		packedFinal[3 + i] = packedFrequencyMap[i];
	}

	for (let i = 0; i < packedEncodedData.data.length; i++) {
		packedFinal[3 + packedFrequencyMap.length + i] =
			packedEncodedData.data[i];
	}

	return packedFinal;
}

function uint16ToNumber(uint16: Uint8Array) {
	return new Uint16Array(uint16.buffer, 0, 1)[0];
}

function uint32ToNumber(uint32: Uint8Array) {
	return new Uint32Array(uint32.buffer, 0, 1)[0];
}

function unpackEncodedData(
	packedEncodedData: Uint8Array,
	bitsToIgnoreAtEnd: number,
): boolean[] {
	const encodedData: boolean[] = [];

	for (let byte of packedEncodedData) {
		encodedData.push(
			...byte
				.toString(2)
				.padStart(8, "0")
				.split("")
				.map(b => b == "1"),
		);
	}

	return encodedData.slice(0, encodedData.length - bitsToIgnoreAtEnd);
}

export function makiHuffmanDecode(data: Uint8Array) {
	const posToData = uint16ToNumber(data.slice(0, 2));
	const bitsToIgnoreAtEnd = data[2];

	const frequencyMap: FrequencyMap = new Map();

	let pos = 3;
	while (pos < posToData) {
		const byte = data[pos++];
		const uintSize = data[pos++];

		let frequency = 0;

		if (uintSize == 1) {
			frequency = data[pos++]; // uint8
		} else if (uintSize == 2) {
			frequency = uint16ToNumber(data.slice(pos, (pos += 2)));
		} else if (uintSize == 3) {
			frequency = uint32ToNumber(data.slice(pos, (pos += 4)));
		} else {
			throw new Error("Unknown uint size");
		}

		frequencyMap.set(byte, frequency);
	}

	const packedEncodedData = data.slice(pos, data.length);
	const encodedData = unpackEncodedData(packedEncodedData, bitsToIgnoreAtEnd);

	const decodedData = decode(frequencyMap, encodedData);

	return decodedData;
}
