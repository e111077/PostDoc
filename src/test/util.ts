import { PostDoc } from "../postdoc";

/* c8 ignore start */

export const INITIAL_MESSAGE = 'Initial message';

export const wait = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const destroyPostdoc = (postdoc: PostDoc) => {
  postdoc.messageReceiver = null;
  postdoc.messageTarget = null;
};

export class ResettablePromise {
  private _isResolved = false;
  private _resolveCompleted!: (value?: unknown) => void;
  completed = new Promise((res) => {
    this._resolveCompleted = res;
  });

  resolve() {
    this._isResolved = true;
    this._resolveCompleted();
  }

  reset() {
    if (this._isResolved) {
      this._isResolved = false;
      this.completed = new Promise((res) => {
        this._resolveCompleted = res;
      });
    }
  }
}

export const checkIframeContent = (iframe: HTMLIFrameElement) => {
  if (!iframe.contentWindow) {
    return null;
  }

  const doc = iframe.contentWindow.document;
  const div = doc.querySelector('div');
  if (!div) {
    return null;
  }

  return div.innerText;
}

export class WorkerTestFixture {
  private _worker: Worker;
  receivedMessages: string[] = [];

  constructor(worker: Worker) {
    this._worker = worker;
    worker.addEventListener('message', this._onMessage);
  }

  destroy() {
    this._worker.removeEventListener('message', this._onMessage);
    this._worker.terminate();
  }

  private _onMessage = (event: MessageEvent<string[]>) => {
    if (!(event.data instanceof Array)) {
      return;
    }
    if (event.data[0] === 'WORKER_RECEIVED_MESSAGE') {
      this.receivedMessages.push(event.data[1]);
    }
  }
}
/* c8 ignore end */