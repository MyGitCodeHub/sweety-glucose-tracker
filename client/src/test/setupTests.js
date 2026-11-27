import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement native <dialog> methods or the reflected open property.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!('open' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'open', {
      configurable: true,
      get() {
        return this.hasAttribute('open');
      },
      set(value) {
        if (value) {
          this.setAttribute('open', '');
        } else {
          this.removeAttribute('open');
        }
      },
    });
  }

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }

  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(returnValue = '') {
      if (returnValue !== undefined) {
        this.returnValue = String(returnValue);
      }
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
