// Cancel the native menu without stopping propagation: authored game menus
// and the camera's right-drag handling still receive contextmenu events.
document.addEventListener('contextmenu', event => event.preventDefault(), { capture: true });
