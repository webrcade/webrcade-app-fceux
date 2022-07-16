import {
  romNameScorer,
  settings,
  AppRegistry,
  FetchAppData,
  Resources,
  Unzip,
  UrlUtil,
  WebrcadeApp,
  APP_TYPE_KEYS,
  LOG,
  TEXT_IDS
} from '@webrcade/app-common'
import { Emulator } from './emulator'

import './App.scss';

class App extends WebrcadeApp {
  emulator = null;

  componentDidMount() {
    super.componentDidMount();

    // Create the emulator
    if (this.emulator === null) {
      this.emulator = new Emulator(this, this.isDebug());
    }

    const { appProps, emulator, ModeEnum } = this;

    // Determine extensions
    // [".nes", ".fds", ".nsf", ".unf", ".nez", ".unif"], future...
    const exts =
      AppRegistry.instance.getExtensions(APP_TYPE_KEYS.FCEUX, true, false);
    const extsNotUnique =
      AppRegistry.instance.getExtensions(APP_TYPE_KEYS.FCEUX, true, true);

    try {
      // Get the ROM location that was specified
      const rom = appProps.rom;
      if (!rom) throw new Error("A ROM file was not specified.");
      const pal = appProps.pal !== undefined ? appProps.pal === true : null;

      // Load emscripten and the ROM
      const uz = new Unzip().setDebug(this.isDebug());
      emulator.loadEmscriptenModule()
        .then(() => settings.load())
        // .then(() => settings.setBilinearFilterEnabled(true))
        // .then(() => settings.setVsyncEnabled(false))
        .then(() => new FetchAppData(rom).fetch())
        .then(response => response.blob())
        .then(blob => uz.unzip(blob, extsNotUnique, exts, romNameScorer))
        .then(blob => new Response(blob).arrayBuffer())
        .then(bytes => emulator.setRom(
          pal,
          uz.getName() ? uz.getName() : UrlUtil.getFileName(rom),
          bytes))
        .then(() => this.setState({ mode: ModeEnum.LOADED }))
        .catch(msg => {
          LOG.error(msg);
          this.exit(this.isDebug() ? msg : Resources.getText(TEXT_IDS.ERROR_RETRIEVING_GAME));
        })
    } catch (e) {
      this.exit(e);
    }
  }

  async onPreExit() {
    try {
      await super.onPreExit();
      await this.emulator.saveState();
    } catch (e) {
      LOG.error(e);
    }
  }

  componentDidUpdate() {
    const { mode } = this.state;
    const { ModeEnum, emulator, canvas } = this;

    if (mode === ModeEnum.LOADED) {
      window.focus();
      // Start the emulator
      emulator.start(canvas);
    }
  }

  renderCanvas() {
    return (
      <canvas style={this.getCanvasStyles()} ref={canvas => { this.canvas = canvas; }} id="screen"></canvas>
    );
  }

  render() {
    const { mode } = this.state;
    const { ModeEnum } = this;

    return (
      <>
        { super.render()}
        { mode === ModeEnum.LOADING ? this.renderLoading() : null}
        { mode === ModeEnum.PAUSE ? this.renderPauseScreen() : null}
        { mode === ModeEnum.LOADED || mode === ModeEnum.PAUSE  ? this.renderCanvas() : null}
      </>
    );
  }
}

export default App;
