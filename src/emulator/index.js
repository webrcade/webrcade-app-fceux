import {
  CIDS,
  DisplayLoop,
  AppWrapper
} from "@webrcade/app-common"

const CONTROLS = {
  INPUT_A: 0x01,
  INPUT_B: 0x02,
  INPUT_SELECT: 0x04,
  INPUT_START: 0x08,
  INPUT_UP: 0x10,
  INPUT_DOWN: 0x20,
  INPUT_LEFT: 0x40,
  INPUT_RIGHT: 0x80
}

const SRAM_NAME = 'rom.sav';

export class Emulator extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    this.fceux = null;
    this.romBytes = null;
    this.romName = null;
    this.pal = null;
    this.saveStatePath = null;
    this.audioChannels = new Array(1);
  }

  detectPal(filename) {
    if (!filename) return false;

    const SEARCH = [
      "(pal)", "(e)", "(europe)",
      "(d)", "(f)", "(g)",
      "(gr)", "(i)", "(nl)",
      "(no)", "(r)", "(s)",
      "(sw)", "(uk)"  
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
      throw new Error("The size is invalid (0 bytes).");
    }
    this.romName = name;
    this.romBytes = bytes;
    this.pal = pal;
    if (this.pal === null || this.pal === undefined) {
      this.pal = this.detectPal(name);
    }
    console.log('name: ' + this.romName);
    console.log('pal: ' + this.pal);
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
          controllers.waitUntilControlReleased(i, CIDS.ESCAPE)
            .then(() => this.showPauseMenu());
          return;
        }
      }

      if (controllers.isControlDown(i, CIDS.UP)) {
        input |= CONTROLS.INPUT_UP;
      }
      else if (controllers.isControlDown(i, CIDS.DOWN)) {
        input |= CONTROLS.INPUT_DOWN;
      }
      if (controllers.isControlDown(i, CIDS.RIGHT)) {
        input |= CONTROLS.INPUT_RIGHT;
      }
      else if (controllers.isControlDown(i, CIDS.LEFT)) {
        input |= CONTROLS.INPUT_LEFT;
      }
      if (controllers.isControlDown(i, CIDS.B) || controllers.isControlDown(i, CIDS.X) ) {
        input |= CONTROLS.INPUT_A;
      }
      if (controllers.isControlDown(i, CIDS.A) || controllers.isControlDown(i, CIDS.Y)) {
        input |= CONTROLS.INPUT_B;
      }
      if (controllers.isControlDown(i, CIDS.SELECT)) {
        input |= CONTROLS.INPUT_SELECT;
      }
      if (controllers.isControlDown(i, CIDS.START)) {
        input |= CONTROLS.INPUT_START;
      }
      bits |= input << (i<<3);
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
            .then(fceux => {
              this.fceux = fceux; 
              fceux.onAbort = msg => app.exit(msg);
              fceux.onExit = () => app.exit();              
              return fceux;
            })
            .then(fceux => resolve(fceux))
            .catch(error => reject(error));
        } else {
          reject('An error occurred loading the FCEUX Emscripten module');
        }
      };
    });
  }

  async loadState() {
    const { fceux, storage } = this;    

    // Load the save state (if applicable)
    try {
      const sram = await storage.get(this.saveStatePath);
      if (sram) {
        const saves = {};
        saves[SRAM_NAME] = sram;
        fceux.importSaveFiles(saves);
      }
    } catch (e) {
      // TODO: Proper logging
      console.error("Error loading save state: " + e);
    }
  }

  async saveState() {
    const { fceux, started, saveStatePath, storage } = this;
    if (!started) {
      return;
    }

    const result = fceux.exportSaveFiles();
    if (saveStatePath && result !== undefined && 
      result[SRAM_NAME] !== undefined) {
      const sram = result[SRAM_NAME];
      if (sram.length === 0) {
        return;
      }
      console.log('saving sram.');
      await storage.put(saveStatePath, sram);
    }
  }

  async onStart(canvas) {
    const { fceux, audioChannels, romBytes, pal, app } = this;

    // Initialize the instance
    fceux.init('#screen');

    // Load the game
    fceux.loadGame(new Uint8Array(romBytes));

    // Load the save state
    this.saveStatePath = app.getStoragePath(`${fceux.gameMd5()}/sav`);
    await this.loadState();

    // Set configuration (controls and video mode)
    fceux.setConfig('system-port-2', 'controller');
    if (pal === true) {
      fceux.setConfig('video-system', 'pal');
    }

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
}
