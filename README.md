# MSA Millenium with RP2040 Touch LCD attachment

Currently still working on modifying this model:

https://www.printables.com/model/538771-rp2040-lcd-128-msa

Attaching this to my MSA Millenium gas mask:

https://www.waveshare.com/wiki/RP2040-Touch-LCD-1.28

## Build

Install `pico-sdk picotool`

```bash
mkdir build
cd build
cmake -GNinja ..
```

Hold `BOOT`, press `RESET`, let go of `BOOT`. Screen should off.

`ninja && sudo picotool load main.uf2`

Press `RESET`

## Usage

Long hold on screen to change screen

## Tools

-   **convert-as-240-h** examples:

    Resizes images to 240x240 using Lanczos2 and saves as const unsigned char .h files

    `deno run -A assets/convert-as-240-h.ts assets/maki.png src/images/maki_image.h`

    `deno run -A assets/convert-as-240-h.ts assets/hexcorp.png src/images/hexcorp_image.h --grayscale`
