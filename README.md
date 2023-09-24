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
