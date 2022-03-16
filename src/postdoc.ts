export type PostMessageTarget =
  | Window
  | MessagePort
  | Worker
  | ServiceWorker
  | Messagable;

interface Messagable {
  postMessage: typeof Worker.prototype.postMessage;
}

export interface messageReceiver {
  addEventListener: typeof Window.prototype.addEventListener;
  removeEventListener: typeof Window.prototype.removeEventListener;
}

export interface PostdocConfig {
  origin: string;
  onMessage: <T = unknown>(message: MessageEvent<T>) => unknown;
  inferTarget: boolean;
  messageTarget?: PostMessageTarget;
  messageReceiver?: messageReceiver;
}

const defaultConfig = {
  origin: '*',
  inferTarget: true,
  onMessage: () => {},
};

enum MESSAGE_TYPE {
  HANDSHAKE = '_DOCTOR_HANDSHAKE',
  HANDSHAKE_ACK = '_DOCTOR_HANDSHAKE_ACK',
}

/**
 * PostDoc is a utility class for sending and receiving messages between
 * MessageEventSources (e.g. a Window or anything with a standard postMessage
 * format
 * `postMessage(message: any, options?: StructuredSerializeOptions | undefined)`
 * ).
 *
 * It is designed to be instantiated at both ends of a message source and
 * automatically set up the necessary event listeners and create a
 * MessageChannel. What differentiates this class from other libraries is that
 * it will readily accept new handshakes from the same target, thus allowing
 * the case of a reloading iframe to "reconnect" to the external frame via
 * handshake.
 *
 * @example
 * ```ts
 * /// In Window
 * import {PostDoc} from 'postdoc';
 *
 * // instantiate
 * const onMessage = (message: MessageEvent) =>
 *    console.log('Parent received:', message.data);
 * const postdoc = new PostDoc({
 *    messageReciever: window,
 *    // note: messageTarget is optional. If not included PostDoc will
 *    // automatically set it to the first MessageEventSource that fires a
 *    // handshake message to the given messageReceiver unless `inferTarget` is
 *    // set to false.
 *    messageTarget: iframe.contentWindow,
 *    onMessage,
 *    // Origin is also optional and defaults to '*' if posting to a Window.
 *    origin: 'https://my-postmessage-origin.com'
 * });
 *
 * // await handshake and postMessage is safe to call
 * await postdoc.handshake;
 * postdoc.postMessage('Hello from window');
 *
 * /// In Iframe that may reload constantly
 * import {PostDoc} from 'postdoc';
 *
 * // Instantiate PostDoc in iframe
 * const onMessage = (message: MessageEvent) =>
 *    console.log('Child received:', message.data);
 * const postdoc = new PostDoc({
 *    messageReciever: window,
 *    messageTarget: window.top!,
 *    onMessage
 * });
 *
 * // await handshake and postMessage is safe to call
 * await postdoc.handshake;
 * postdoc.postMessage('Hello from iframe');
 * ```
 */
export class PostDoc {
  private _messageTarget: PostMessageTarget | null = null;
  private _messageReceiver: messageReceiver | null = null;
  private _origin: string;
  private _resolveHandshake: (value: PostDoc | PromiseLike<PostDoc>) => void =
    () => {};
  private _messageChannel: MessageChannel | null = null;
  private _messagePort: MessagePort | null = null;
  private _onMessage: <T = unknown>(message: MessageEvent<T>) => unknown;
  private _handshake!: Promise<PostDoc>;
  private _handshakeComplete: boolean = false;
  private _messagePortDirty: boolean = false;
  private _inferTarget = true;

  /**
   * Promise that resolves when the handshake is complete.
   */
  get handshake() {
    return this._handshake;
  }

  /**
   * Function to be called when a message is received through the PostDoc
   * message channel.
   */
  get onMessage() {
    return this._onMessage;
  }

  set onMessage(
    newOnMessage: <T = unknown>(message: MessageEvent<T>) => unknown
  ) {
    if (this._messagePort) {
      this._messagePort.removeEventListener('message', this._onMessage);
    }

    this._onMessage = newOnMessage;

    if (this._messagePort) {
      this._messagePort.addEventListener('message', newOnMessage);
    }
  }

  set messageReceiver(newReceiver) {
    if (this._messageReceiver) {
      this._messageReceiver.removeEventListener(
        'message',
        this._onMessageReceiverMessage
      );
    }
    this._messageReceiver = newReceiver;
    if (newReceiver) {
      newReceiver.addEventListener('message', this._onMessageReceiverMessage);
    }
  }

  /**
   * MessageEventSource that should be listended to for handshake messages.
   */
  get messageReceiver() {
    return this._messageReceiver;
  }

  set messageTarget(newTarget) {
    this._messageTarget = newTarget;
    if (this._messageTarget) {
      this._destroyMessagePort();
      this._resetHandshake();
      this._postMessageToTarget(MESSAGE_TYPE.HANDSHAKE);
    }
  }

  /**
   * Target for handshake messages. If omitted, this will be set to the first
   * MessageEventSource that fires a handshake message to the given
   * messageReceiver as long as `inferTarget` is not `false`, set at the
   * constructor.
   *
   * Note, if handshake is fired to receiver before PostDoc is instantiated, the
   * handshake will not resolve. This can be prevented in most cases by setting
   * messageTarget in both message sources. Additionally, `messageReceiver`
   * should be set before `messageTarget` or set in the constructor.
   */
  get messageTarget() {
    return this._messageTarget;
  }

  /**
   * @param config Optional configuration object. All items other than `origin`
   *   can be set as properties after instantiation, but `messageTarget` should
   *   not be set before `messageReceiver` is set or else postdoc may miss the
   *   handskake acknowledgement message. `origin` defaults to `'*'` and is
   *   only used if `messageTarget` is a `Window`.
   */
  constructor(config?: Partial<PostdocConfig>) {
    const {
      inferTarget: infer,
      origin,
      messageTarget,
      messageReceiver,
      onMessage,
    }: PostdocConfig = {
      ...defaultConfig,
      ...config,
    };
    this._onMessage = onMessage;
    this._origin = origin;
    this._inferTarget = infer;
    this._resetHandshake(true);

    if (messageReceiver) {
      this.messageReceiver = messageReceiver;
    }

    if (messageTarget) {
      // Setter fires handshake message.
      this.messageTarget = messageTarget;
    }
  }

  /**
   * Resets the handshake if already completed and sets the handshake promise to
   * a new, unresolved promise.
   *
   * @param force If true, will reset the handshake even if it not complete.
   *   This is useful for initialization.
   */
  private _resetHandshake(force = false) {
      if (force || this._handshakeComplete) {
      this._handshakeComplete = false;
      this._handshake = new Promise((resolve) => {
        this._resolveHandshake = resolve;
      });
    }
  }

  /**
   * Called when the messageReceiver receives a `message` event and executes
   * handshake logic if redceived.
   *
   * @param event The MessageEvent that was received.
   */
  private _onMessageReceiverMessage = (event: MessageEvent<MESSAGE_TYPE>) => {
    switch (event.data) {
      case MESSAGE_TYPE.HANDSHAKE:
        this._onHandshake(event);
        break;
      case MESSAGE_TYPE.HANDSHAKE_ACK:
        this._onHandshakeAck(event);
        break;
      default:
        ((never: never) => never)(event.data);
        break;
    }
  };

  /**
   * Posts a message to the messageTarget. If it is a Window, it will post the
   * message with the origin of `this.origin`. Necessary to normalize the
   * signatures of `Window.postMessage` and
   * `(MessagePort|ServiceWorker).postMessage`.
   *
   * @param message The message to be posted to messageTarget.
   * @param transfer Transferables to be transferred to messageTarget.
   */
  private _postMessageToTarget(message: string, transfer?: Transferable[]) {
    if (!this._messageTarget) {
      throw new Error('messageTarget not defined');
    }

    if ('window' in this._messageTarget) {
      this._messageTarget.postMessage(message, this._origin, transfer);
    } else {
      this._messageTarget.postMessage(message, { transfer });
    }
  }

  /**
   * Triggered whenever a handshake message request is received.
   *
   * Creates a new message channel, cleans up previous message channel listeners
   * from previous handshakes if necessary, sets messageTarget if necessary, and
   * posts a handshake acknowledgement message back with one of the message
   * channel ports.
   *
   * @param event The handshake MessageEvent.
   */
  private _onHandshake(event: MessageEvent<MESSAGE_TYPE>) {
    // infer the message target if necessary
    if (this._inferTarget && !this.messageTarget && event.source) {
      this._messageTarget = event.source;
      // Target is not to be inferred, and does not match the given target.
    } else if (
      this.messageTarget &&
      event.source &&
      event.source !== this.messageTarget
    ) {
      return;
    }

    if (!this.messageTarget) {
      return;
    }

    this._resetHandshake();
    if (this._messagePort) {
      this._destroyMessagePort();
    }
    this._messagePortDirty = true;
    this._messageChannel = new MessageChannel();
    this._messagePort = this._messageChannel.port1;
    this._messagePort.addEventListener('message', this.onMessage);
    this._messagePort.start();

    this._postMessageToTarget(MESSAGE_TYPE.HANDSHAKE_ACK, [
      this._messageChannel.port2,
    ]);
  }

  /**
   * Triggered whenever a handshake acknowledgement message is received. That
   * would be a response when a handshake message was sent or whether the
   * receiving end has acknowledged an acknowledgement.
   *
   * If this message event source posted a handshake, this will receive the
   * transferrred message port, listen to it, fire an acknowledgement of the
   * acknowledgement, and resolve the handshake.
   *
   * If this message even source did not post a handshake but rather posted an
   * acknowledgement to a previous handshake, then this will resolve the
   * handhsake.
   *
   * @param event The handshake acknowledgement MessageEvent.
   */
  private _onHandshakeAck(event: MessageEvent<MESSAGE_TYPE>) {
    if (!this._inferTarget && !this.messageTarget) {
      return;
    }

    if (!this.messageTarget) {
      throw new Error('messageTarget not defined');
    }

    if (event.source && event.source !== this.messageTarget) {
      return;
    }

    if (!this._messagePort || this._messagePortDirty && event.ports[0]) {
      this._messagePort = event.ports[0];
      this._messagePort.addEventListener('message', this.onMessage);
      this._messagePort.start();
      this._postMessageToTarget(MESSAGE_TYPE.HANDSHAKE_ACK);
    }

    this._messagePortDirty = false;
    this._handshakeComplete = true;
    this._resolveHandshake(this);
  }

  private _destroyMessagePort() {
    if (this._messageChannel) {
      this._messageChannel.port1.removeEventListener('message', this.onMessage);
      this._messageChannel.port1.close();
      this._messageChannel.port2.removeEventListener('message', this.onMessage);
      this._messageChannel.port2.close();
    } else if (this._messagePort) {
      this._messagePort.removeEventListener('message', this.onMessage);
      this._messagePort.close();
    }

    this._messageChannel = null;
    this._messagePort = null;
  }

  /**
   * Posts a message to the paired postdoc. It is expected to await the
   * handshake promise before calling this method. If the handshake is not
   * resolved, then this will throw an error.
   *
   * @param message The message to be sent to the paired postdoc.
   */
  postMessage<T = unknown>(message: T, options?: StructuredSerializeOptions) {
    if (!this._messagePort || !this._handshakeComplete) {
      throw new Error('Handhsake not complete');
    }
    this._messagePort.postMessage(message, options);
  }
}
