import React from 'react';
import { Component } from 'react';

import {
  STATE_SLOTS,
  TEXT_IDS,
  CloudUploadBlackImage,
  CloudUploadWhiteImage,
  CloudDownloadBlackImage,
  CloudDownloadWhiteImage,
  DeleteForeverBlackImage,
  DeleteForeverWhiteImage,
  EditorScreen,
  EditorTab,
  ImageButton,
  Resources,
  SaveWhiteImage,
  WebrcadeContext,
} from '@webrcade/app-common';

const DATE_FORMAT = {
  month: '2-digit', day: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit'
};

export class SaveStatesEditor extends Component {

  constructor() {
    super();
    this.state = {
      tabIndex: null,
      focusGridComps: null,
      slots: new Array(STATE_SLOTS),
      loaded: false
    };
  }

  async updateStates(showStatus = true) {
    const { emulator } = this.props;

    const slots = await emulator.getStateSlots(showStatus)
    this.setState({
      loaded: true,
      slots: slots ? slots : this.state.slots
    });
  }

  componentDidMount() {
    const { loaded } = this.state;

    if (!loaded) {
      this.updateStates();
    }
  }

  render() {
    const { emptyImageSrc, emulator, onClose, showStatusCallback } = this.props;
    const { loaded, slots, tabIndex, focusGridComps } = this.state;

    if (!loaded) return null;

    const setFocusGridComps = (comps) => {
      this.setState({ focusGridComps: comps });
    };

    const tabs = []
    for (let i = 0; i < STATE_SLOTS; i++) {
      const slot = i + 1;
      tabs.push(
        {
          image: SaveWhiteImage,
          label: `Save Slot ${slot}`,
          content: (
            <SlotTab
              emptyImageSrc={emptyImageSrc}
              updateStates={async (showStatus) => { await this.updateStates(showStatus) }}
              onClose={onClose}
              slot={slot}
              slots={slots}
              emulator={emulator}
              isActive={tabIndex === i}
              setFocusGridComps={setFocusGridComps}
              showStatusCallback={showStatusCallback}
            />
          ),
        }
      )
    }

    return (
      <EditorScreen
        showCancel={false}
        onOk={() => { onClose(); }}
        onClose={onClose}
        focusGridComps={focusGridComps}
        onTabChange={(oldTab, newTab) => this.setState({ tabIndex: newTab })}
        tabs={tabs}
      />
    );
  }
}

class SlotTab extends EditorTab {
  constructor() {
    super();
    this.loadRef = React.createRef();
    this.saveRef = React.createRef();
    this.deleteRef = React.createRef();
    this.gridComps = [[this.loadRef, this.saveRef, this.deleteRef]];
  }

  componentDidUpdate(prevProps, prevState) {
    const { gridComps } = this;
    const { setFocusGridComps } = this.props;
    const { isActive } = this.props;

    if (isActive && isActive !== prevProps.isActive) {
      setFocusGridComps(gridComps);
    }
  }

  render() {
    const { loadRef, saveRef, deleteRef } = this;
    const { focusGrid } = this.context;
    const { emptyImageSrc, emulator, onClose, slot, slots, updateStates, showStatusCallback } = this.props;

    const currentSlot = slots[slot];

    return (
      <div className="slottab">
        <div className="slottab-content">
          <div className="slottab-content-left">
            <img alt="screenshot" src={currentSlot ? currentSlot.shot : emptyImageSrc} />
          </div>
          <div className="slottab-content-right">
            <div className="slottab-content-right-title">
              {Resources.getText(TEXT_IDS.SAVE_TIME)}
            </div>
            <div className="slottab-content-right-subtitle">
              {currentSlot ?
                new Date(currentSlot.time).toLocaleString([], DATE_FORMAT) :
                Resources.getText(TEXT_IDS.SAVE_DOES_NOT_EXIST)}
            </div>
            <div className="slottab-content-right-buttons">
              {currentSlot &&
                <ImageButton
                  ref={loadRef}
                  onPad={e => focusGrid.moveFocus(e.type, loadRef)}
                  label={Resources.getText(TEXT_IDS.LOAD)}
                  imgSrc={CloudDownloadBlackImage}
                  hoverImgSrc={CloudDownloadWhiteImage}
                  onClick={async () => {
                    await emulator.loadStateForSlot(slot);
                    onClose();
                  }}
                />
              }
              <ImageButton
                ref={saveRef}
                onPad={e => focusGrid.moveFocus(e.type, saveRef)}
                label={Resources.getText(TEXT_IDS.SAVE)}
                imgSrc={CloudUploadBlackImage}
                hoverImgSrc={CloudUploadWhiteImage}
                onClick={async () => {
                  await emulator.saveStateForSlot(slot);
                  onClose();
                }}
              />
              {currentSlot &&
                <ImageButton
                  ref={deleteRef}
                  onPad={e => focusGrid.moveFocus(e.type, deleteRef)}
                  label={Resources.getText(TEXT_IDS.DELETE)}
                  imgSrc={DeleteForeverBlackImage}
                  hoverImgSrc={DeleteForeverWhiteImage}
                  onClick={async () => {
                    try {
                      showStatusCallback(Resources.getText(TEXT_IDS.CLOUD_DELETING));
                      await emulator.deleteStateForSlot(slot, false);
                      await updateStates(false);
                    } finally {
                      this.saveRef.current.focus();
                      showStatusCallback(null)
                    }
                  }}
                />
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
}
SlotTab.contextType = WebrcadeContext;
