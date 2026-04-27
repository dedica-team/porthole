import '@testing-library/jest-dom';

// jsdom doesn't implement canvas.getContext() – stub it so Three.js
// CanvasTexture / nameSprite calls don't throw in renderer unit tests.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === '2d') {
      return {
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        roundRect: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        measureText: () => ({ width: 0 }),
        canvas: this,
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}
