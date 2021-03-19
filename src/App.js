import { WebrcadeApp, FetchAppData, Unzip, UrlUtil } from '@webrcade/app-common'
import { Emulator } from './emulator'

import './App.scss';
import '@webrcade/app-common/dist/index.css'

class App extends WebrcadeApp {
  emulator = new Emulator(this);

  componentDidMount() {
    super.componentDidMount();

    const { appProps, emulator, ModeEnum } = this;    

    // Get the ROM location that was specified
    const rom = appProps.rom;
    if (!rom) throw new Error("A ROM file was not specified.");
    const pal = appProps.pal !== undefined ? appProps.pal === true : null;

    // Load emscripten and the ROM
    const uz = new Unzip();
    emulator.loadEmscriptenModule()
      .then(() => new FetchAppData(rom).fetch())
      .then(response => response.blob())
      .then(blob => uz.unzip(blob, [".nes", ".fds", ".nsf", ".unf", ".nez", ".unif"]))
      .then(blob => new Response(blob).arrayBuffer())
      .then(bytes => emulator.setRom(
        pal,
        uz.getName() ? uz.getName() : UrlUtil.getFileName(rom), 
        bytes))
      .then(() => this.setState({mode: ModeEnum.LOADED}))
      .catch(msg => { 
        this.exit("Error fetching ROM: " + msg);
      })
  }  

  async onPreExit() {
    await super.onPreExit();
    this.emulator.saveState();
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
      <div id="screen-wrapper">
        <canvas ref={canvas => { this.canvas = canvas;}} id="screen"></canvas>
      </div>      
    );
  }

  render() {
    const { mode } = this.state;
    const { ModeEnum } = this;

    return (
      <>
        { mode === ModeEnum.LOADING ? this.renderLoading() : null}
        { mode === ModeEnum.LOADED ? this.renderCanvas() : null}
      </>
    );
  }
}

export default App;
