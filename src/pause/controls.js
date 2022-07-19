import React from "react";

import {
  ControlsTab,
} from '@webrcade/app-common'

export class GamepadControlsTab extends ControlsTab {
  render() {
    return (
      <>
        {this.renderControl("start", "Start")}
        {this.renderControl("select", "Select")}
        {this.renderControl("dpad", "Move")}
        {this.renderControl("lanalog", "Move")}
        {this.renderControl("b", "A")}
        {this.renderControl("x", "A")}
        {this.renderControl("a", "B")}
        {this.renderControl("y", "B")}
      </>
    );
  }
}

export class KeyboardControlsTab extends ControlsTab {
  render() {
    return (
      <>
        {this.renderKey("Enter", "Start")}
        {this.renderKey("ShiftRight", "Select")}
        {this.renderKey("ArrowUp", "Up")}
        {this.renderKey("ArrowDown", "Down")}
        {this.renderKey("ArrowLeft", "Left")}
        {this.renderKey("ArrowRight", "Right")}
        {this.renderKey("KeyX", "A")}
        {this.renderKey("KeyA", "A")}
        {this.renderKey("KeyZ", "B")}
        {this.renderKey("KeyS", "B")}
      </>
    );
  }
}
