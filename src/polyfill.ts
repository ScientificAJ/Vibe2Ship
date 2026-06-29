// Polyfill to prevent "canvas.getBoundingClientRect is not a function" errors in testing / headless environments
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    // 1. Ensure HTMLCanvasElement prototype has a fallback getBoundingClientRect method
    if (typeof HTMLCanvasElement !== 'undefined') {
      const proto = HTMLCanvasElement.prototype as any;
      if (!proto.getBoundingClientRect || typeof proto.getBoundingClientRect !== 'function') {
        proto.getBoundingClientRect = function(this: HTMLCanvasElement) {
          return {
            width: this.width || 0,
            height: this.height || 0,
            top: 0,
            left: 0,
            right: this.width || 0,
            bottom: this.height || 0,
            x: 0,
            y: 0,
            toJSON: () => {}
          } as DOMRect;
        };
      }
    }
  } catch (e) {
    console.error('Canvas prototype polyfill failed:', e);
  }

  try {
    // 2. Ensure document.createElement('canvas') returns an element with getBoundingClientRect
    const originalCreateElement = document.createElement;
    if (originalCreateElement && !(originalCreateElement as any).__isPolyfilled) {
      const polyfilledCreateElement = function(this: Document, tagName: string, options?: ElementCreationOptions) {
        // Handle detached or contextless calls to document.createElement
        const context = (this === document || this instanceof Document) ? this : document;
        const element = originalCreateElement.call(context, tagName, options);
        
        if (tagName && tagName.toLowerCase() === 'canvas') {
          if (!element.getBoundingClientRect || typeof element.getBoundingClientRect !== 'function') {
            element.getBoundingClientRect = function() {
              return {
                width: (element as any).width || 0,
                height: (element as any).height || 0,
                top: 0,
                left: 0,
                right: (element as any).width || 0,
                bottom: (element as any).height || 0,
                x: 0,
                y: 0,
                toJSON: () => {}
              } as DOMRect;
            };
          }
        }
        return element;
      };
      (polyfilledCreateElement as any).__isPolyfilled = true;
      document.createElement = polyfilledCreateElement;
    }
  } catch (e) {
    console.error('Document.createElement polyfill failed:', e);
  }
}

export {};
