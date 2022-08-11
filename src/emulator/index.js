import {
  AppWrapper,
  DisplayLoop,
  ScriptAudioProcessor,
  LOG,
  CIDS,
} from '@webrcade/app-common';

const CONTROLS = {
  INPUT_A: 0x01,
  INPUT_B: 0x02,
  INPUT_SELECT: 0x04,
  INPUT_START: 0x08,
  INPUT_UP: 0x10,
  INPUT_DOWN: 0x20,
  INPUT_LEFT: 0x40,
  INPUT_RIGHT: 0x80,
};

const SRAM_NAME = 'rom.sav';
const SAVE_NAME = 'sav';

export class Emulator extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    window.emulator = this;
    this.fceux = null;
    this.romBytes = null;
    this.romName = null;
    this.pal = null;
    this.saveStatePath = null;
    this.audioChannels = new Array(1);

    for (let i = 0; i < 256; i++) {
      this.palette[i] = [0, 0, 0];
    }
  }

  detectPal(filename) {
    if (!filename) return false;

    const SEARCH = [
      '(pal)',
      '(e)',
      '(europe)',
      '(d)',
      '(f)',
      '(g)',
      '(gr)',
      '(i)',
      '(nl)',
      '(no)',
      '(r)',
      '(s)',
      '(sw)',
      '(uk)',
    ];

    filename = filename.toLowerCase();
    for (const s of SEARCH) {
      if (filename.indexOf(s) !== -1) {
        return true;
      }
    }

    return false;
  }

  setRom(pal, name, bytes) {
    if (bytes.byteLength === 0) {
      throw new Error('The size is invalid (0 bytes).');
    }
    this.romName = name;
    this.romBytes = bytes;
    this.pal = pal;
    if (this.pal === null || this.pal === undefined) {
      this.pal = this.detectPal(name);
    }
    LOG.info('name: ' + this.romName);
    LOG.info('pal: ' + this.pal);
  }

  createAudioProcessor() {
    return new ScriptAudioProcessor(1).setDebug(this.debug);
  }

  async onShowPauseMenu() {
    await this.saveState();
  }

  pollControls() {
    const { controllers, fceux } = this;

    controllers.poll();

    let bits = 0;
    for (let i = 0; i < 2; i++) {
      let input = 0;

      if (controllers.isControlDown(i, CIDS.ESCAPE)) {
        if (this.pause(true)) {
          controllers
            .waitUntilControlReleased(i, CIDS.ESCAPE)
            .then(() => this.showPauseMenu());
          return;
        }
      }

      if (controllers.isControlDown(i, CIDS.UP)) {
        input |= CONTROLS.INPUT_UP;
      } else if (controllers.isControlDown(i, CIDS.DOWN)) {
        input |= CONTROLS.INPUT_DOWN;
      }
      if (controllers.isControlDown(i, CIDS.RIGHT)) {
        input |= CONTROLS.INPUT_RIGHT;
      } else if (controllers.isControlDown(i, CIDS.LEFT)) {
        input |= CONTROLS.INPUT_LEFT;
      }
      if (
        controllers.isControlDown(i, CIDS.B) ||
        controllers.isControlDown(i, CIDS.X)
      ) {
        input |= CONTROLS.INPUT_A;
      }
      if (
        controllers.isControlDown(i, CIDS.A) ||
        controllers.isControlDown(i, CIDS.Y)
      ) {
        input |= CONTROLS.INPUT_B;
      }
      if (controllers.isControlDown(i, CIDS.SELECT)) {
        input |= CONTROLS.INPUT_SELECT;
      }
      if (controllers.isControlDown(i, CIDS.START)) {
        input |= CONTROLS.INPUT_START;
      }
      bits |= input << (i << 3);
    }
    fceux.setControllerBits(bits);
  }

  loadEmscriptenModule() {
    const { app } = this;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'fceux.js';
      script.async = true;
      script.onload = () => {
        const esmodule = window.FCEUX;
        if (esmodule) {
          esmodule()
            .then((fceux) => {
              this.fceux = fceux;
              fceux.onAbort = (msg) => app.exit(msg);
              fceux.onExit = () => app.exit();
              return fceux;
            })
            .then((fceux) => resolve(fceux))
            .catch((error) => reject(error));
        } else {
          reject('An error occurred loading the FCEUX Emscripten module');
        }
      };
    });
  }

  async migrateSaves() {
    const { storage } = this;

    // Load old saves (if applicable)
    const sram = await storage.get(this.saveStatePath);
    if (sram) {
      LOG.info('Migrating local saves.');

      await this.getSaveManager().saveLocal(this.saveStatePath, [
        {
          name: SAVE_NAME,
          content: sram,
        },
      ]);

      // Delete old location (and info)
      await storage.remove(this.saveStatePath);
      await storage.remove(`${this.saveStatePath}/info`);
    }
  }

  async loadState() {
    const { fceux } = this;

    // Load the save state (if applicable)
    try {
      // Migrate old save format
      await this.migrateSaves();

      // Load from new save format
      const files = await this.getSaveManager().load(
        this.saveStatePath,
        this.loadMessageCallback,
      );

      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.name === SAVE_NAME) {
            const sram = f.content;
            const saves = {};
            saves[SRAM_NAME] = sram;
            fceux.importSaveFiles(saves);
            break;
          }
        }
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  async saveInOldFormat(sram) {
    const { saveStatePath } = this;
    // old, for testing migration
    await this.saveStateToStorage(saveStatePath, sram);
  }

  async saveState() {
    const { fceux, saveStatePath, started } = this;

    try {
      if (!started) {
        return;
      }

      const result = fceux.exportSaveFiles();
      if (
        saveStatePath &&
        result !== undefined &&
        result[SRAM_NAME] !== undefined
      ) {
        const sram = result[SRAM_NAME];
        if (sram.length === 0) {
          return;
        }
        LOG.info('saving sram.');

        //await this.saveInOldFormat(sram);
        await this.getSaveManager().save(
          this.saveStatePath,
          [
            {
              name: SAVE_NAME,
              content: sram,
            },
          ],
          this.saveMessageCallback,
        );
      }
    } catch (e) {
      LOG.error('Error persisting save state: ' + e);
    }
  }

  async onStart(canvas) {
    const { app, audioChannels, fceux, pal, romBytes } = this;

    this.canvas = canvas;

    // Initialize the instance
    fceux.init('#screen');

    // Load the game
    fceux.loadGame(new Uint8Array(romBytes));

    // Load the save state
    this.saveStatePath = app.getStoragePath(`${fceux.gameMd5()}/${SAVE_NAME}`);
    await this.loadState();

    // Set configuration (controls and video mode)
    fceux.setConfig('system-port-2', 'controller');
    if (pal === true) {
      fceux.setConfig('video-system', 'pal');
    }

    // Init video
    this.initVideo(canvas);

    // Create display loop
    this.displayLoop = new DisplayLoop(pal ? 50 : 60, true, this.debug);
    window.fceux = fceux; // TODO: Fix this
    audioChannels[0] = fceux.getAudioBuffer();

    // audio
    this.audioProcessor.start();

    // game loop
    const audioProcessor = this.audioProcessor;

    // Start the game loop
    this.displayLoop.start(() => {
      const samples = fceux.update();
      audioProcessor.storeSound(audioChannels, samples);
      this.pollControls();
    });
  }

  NES_WIDTH = 256;
  NES_HEIGHT = 256;
  PIXEL_COUNT = this.NES_WIDTH * this.NES_HEIGHT;
  palette = new Array(256);

  clearImageData(image, imageData, pixelCount) {
    for (var i = 0; i < pixelCount * 4; ) {
      imageData[i++] = 0;
      imageData[i++] = 0;
      imageData[i++] = 0;
      imageData[i++] = 0xff;
    }
    this.context.putImageData(image, 0, 0);
  }

  initVideo(canvas) {
    const { pal, NES_WIDTH, NES_HEIGHT, PIXEL_COUNT } = this;

    canvas.width = 255;
    canvas.height = pal ? 240 : 224;
    this.context = this.canvas.getContext('2d');
    this.image = this.context.getImageData(0, 0, NES_WIDTH, NES_HEIGHT);
    this.imageData = this.image.data;
    this.clearImageData(this.image, this.imageData, PIXEL_COUNT);
  }

  applyDefaultPalette() {
    const UNSAT_FINAL = [
      0x676767, 0x001f8e, 0x23069e, 0x40008e, 0x600067, 0x67001c, 0x5b1000,
      0x432500, 0x313400, 0x074800, 0x004f00, 0x004622, 0x003a61, 0x000000,
      0x000000, 0x000000, 0xb3b3b3, 0x205adf, 0x5138fb, 0x7a27ee, 0xa520c2,
      0xb0226b, 0xad3702, 0x8d5600, 0x6e7000, 0x2e8a00, 0x069200, 0x008a47,
      0x037b9b, 0x101010, 0x000000, 0x000000, 0xffffff, 0x62aeff, 0x918bff,
      0xbc78ff, 0xe96eff, 0xfc6ccd, 0xfa8267, 0xe29b26, 0xc0b901, 0x84d200,
      0x58de38, 0x46d97d, 0x49ced2, 0x494949, 0x000000, 0x000000, 0xffffff,
      0xc1e3ff, 0xd5d4ff, 0xe7ccff, 0xfbc9ff, 0xffc7f0, 0xffd0c5, 0xf8daaa,
      0xebe69a, 0xd1f19a, 0xbef7af, 0xb6f4cd, 0xb7f0ef, 0xb2b2b2, 0x000000,
      0x000000,
    ];

    for (let i = 0; i < UNSAT_FINAL.length; i++) {
      const c = UNSAT_FINAL[i];
      this.palette[128 + i] = [
        ((c & 0xff0000) >> 16) & 0xff,
        ((c & 0xff00) >> 8) & 0xff,
        c & 0xff,
      ];
    }
  }

  setPaletteColor(index, r, g, b) {
    //console.log("palette " + index + " = " + r + ", " + g + ", " + b);
    this.palette[index] = [r, g, b];
    this.applyDefaultPalette();
  }

  drawScreen(buff) {
    const { fceux, image, imageData, pal, palette, PIXEL_COUNT } = this;
    const b = new Uint8Array(fceux.HEAP8.buffer, buff, PIXEL_COUNT);
    let index = 0;
    let line = 0;
    for (let i = 0; i < PIXEL_COUNT; i++) {
      if (pal || (line > 8 && line <= 248)) {
        let c = (b[i] + 128) % 256;
        imageData[index++] = palette[c][0];
        imageData[index++] = palette[c][1];
        imageData[index++] = palette[c][2];
        index++;
      }
      if (i % 256 === 0) line++;
    }
    this.context.putImageData(image, 0, 0);
  }
}
