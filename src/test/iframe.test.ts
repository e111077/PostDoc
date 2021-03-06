import { expect, fixture, html, fixtureCleanup } from '@open-wc/testing';
import { PostDoc } from '../postdoc';
import { INITIAL_MESSAGE as FRAME_INITIAL_MESSAGE, wait, destroyPostdoc, ResettablePromise, checkIframeContent } from './util.js';

describe('iframe and host', () => {
  let postdoc: PostDoc;
  let postdoc2: PostDoc;

  beforeEach(() => {
    postdoc = undefined as unknown as PostDoc;
    postdoc2 = undefined as unknown as PostDoc;
  });

  it('sets up and handshakes when set up before load via constructor and infers target', async () => {
    const messagesReceived: string[] = [];

    postdoc = new PostDoc({
      messageReceiver: window,
      inferTarget: true,
      onMessage: (event: MessageEvent) => {
        messagesReceived.push(event.data);
      },
    });

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe src="/src/test/frame-code/frame.html"></iframe>
    `);

    await postdoc.handshake;
    await wait(50);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);
    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
  });

  it('can post when set up before load via constructor', async () => {
    postdoc = new PostDoc({
      messageReceiver: window,
      inferTarget: true
    });

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe src="/src/test/frame-code/frame.html"></iframe>
    `);

    await postdoc.handshake;
    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);
    const iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);
  });

  it('sets up and handshakes when set up after load via constructor', async () => {
    const messagesReceived: string[] = [];
    let resolveLoaded = (_value?: unknown) => {};

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe
        src="/src/test/frame-code/frame.html"
        @load=${() => resolveLoaded()}
      ></iframe>
    `);

    await loaded;
    // Purposefully miss the initial handshake
    await wait(50);

    postdoc = new PostDoc({
      messageReceiver: window,
      messageTarget: iframe.contentWindow!,
      onMessage: (event: MessageEvent) => {
        messagesReceived.push(event.data);
      },
    });

    await postdoc.handshake;
    await wait(50);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);
  });

  it('handshakes and posts when set up via props', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };
    let resolveLoaded = (_value?: unknown) => {};

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe
        src="/src/test/frame-code/frame.html"
        @load=${() => resolveLoaded()}
      ></iframe>
    `);

    await loaded;
    // Purposefully miss the initial handshake
    await wait(50);

    postdoc = new PostDoc();
    postdoc.messageReceiver = window;
    postdoc.messageTarget = iframe.contentWindow!;
    postdoc.onMessage = onMessage;

    await postdoc.handshake;
    await wait(50);
    expect(postdoc.messageReceiver).to.equal(window);
    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    const iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);
  });

  it('onMessage can be reset via props', async () => {
    const messagesReceived: string[] = [];
    const messagesReceived2: string[] = [];

    const loaded = new ResettablePromise();

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe
        src="/src/test/frame-code/frame.html"
        @load=${() => loaded.resolve()}
      ></iframe>
    `);

    await loaded.completed;
    // intentionally miss initial handshake
    await wait(50);

    postdoc = new PostDoc({
      messageReceiver: window,
      messageTarget: iframe.contentWindow!,
      onMessage: (event: MessageEvent) => {
        messagesReceived.push(event.data);
      },
    });

    await postdoc.handshake;
    await wait(50);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    postdoc.onMessage = (event: MessageEvent) => {
      messagesReceived2.push(event.data);
    };

    loaded.reset();
    iframe.contentWindow!.location.reload();

    await loaded.completed;
    await postdoc.handshake;
    await wait(50);

    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived2.length).to.equal(1);
    expect(messagesReceived2[0]).to.equal(FRAME_INITIAL_MESSAGE);
  });

  it('inferTarget:false will not infer target', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };
    let resolveLoaded = (_value?: unknown) => {};
    postdoc = new PostDoc({
      onMessage,
      messageReceiver: window,
    });

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe
        src="/src/test/frame-code/frame.html"
        @load=${() => resolveLoaded()}
      ></iframe>
    `);

    await loaded;
    // Purposefully miss the initial handshake
    await wait(50);

    expect(postdoc.messageTarget).to.be.null;
    postdoc.messageTarget = iframe.contentWindow!;

    await postdoc.handshake;
    await wait(50);
    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    const iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);
  });

  it('two iframes', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };
    let resolveLoaded = (_value?: unknown) => {};
    let resolveLoaded2 = (_value?: unknown) => {};
    postdoc = new PostDoc({
      inferTarget: false,
      onMessage,
      messageReceiver: window,
    });

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const loaded2 = new Promise((res) => {
      resolveLoaded2 = res;
    });

    const iframes = await fixture<HTMLDivElement>(html`
      <div>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded()}
        ></iframe>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded2()}
        ></iframe>
      </div>
    `);

    const iframe = iframes.querySelector('iframe')!;
    const iframe2 = iframes.querySelectorAll('iframe')[1];

    await Promise.all([loaded, loaded2]);
    // Purposefully miss the initial handshake
    await wait(50);

    expect(postdoc.messageTarget).to.be.null;
    postdoc.messageTarget = iframe2.contentWindow!;

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(iframe2.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    const iframeText = checkIframeContent(iframe2);
    expect(iframeText).to.equal(MESSAGE);

    const iframeText2 = checkIframeContent(iframe);
    expect(iframeText2).to.be.null;
  });

  it('ignores second iframe from non-matching source', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };

    const loaded = new ResettablePromise();
    const loaded2 = new ResettablePromise();

    const iframes = await fixture<HTMLDivElement>(html`
      <div>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => loaded.resolve()}
        ></iframe>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => loaded2.resolve()}
        ></iframe>
      </div>
    `);

    const iframe = iframes.querySelectorAll('iframe')[0];
    const iframe2 = iframes.querySelectorAll('iframe')[1];

    await Promise.all([loaded.completed, loaded2.completed]);
    // Purposefully miss the initial handshake
    await wait(50);

    postdoc = new PostDoc({
      onMessage,
      messageReceiver: window,
      inferTarget: true
    });

    // set up correctly
    expect(postdoc.messageTarget).to.be.null;

    // Connect postdoc to first iframe by inferring target
    loaded.reset();
    iframe.contentWindow!.location.reload();

    await loaded.completed;
    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    // Reload non-matching iframe
    loaded2.reset();
    iframe2.contentWindow!.location.reload();

    await loaded2.completed;
    await postdoc.handshake;
    await wait(50);

    // state should be the same since ignored
    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);
  });

  it('switching iframes', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };
    let resolveLoaded = (_value?: unknown) => {};
    let resolveLoaded2 = (_value?: unknown) => {};
    postdoc = new PostDoc({
      inferTarget: false,
      onMessage,
      messageReceiver: window,
    });

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const loaded2 = new Promise((res) => {
      resolveLoaded2 = res;
    });

    const iframes = await fixture<HTMLDivElement>(html`
      <div>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded()}
        ></iframe>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded2()}
        ></iframe>
      </div>
    `);

    const iframe = iframes.querySelector('iframe')!;
    const iframe2 = iframes.querySelectorAll('iframe')[1];

    await Promise.all([loaded, loaded2]);
    // Purposefully miss the initial handshake
    await wait(50);

    expect(postdoc.messageTarget).to.be.null;
    postdoc.messageTarget = iframe.contentWindow!;

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(iframe.contentWindow!);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    let iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);


    let iframeText2 = checkIframeContent(iframe2);
    expect(iframeText2).to.be.null;

    postdoc.messageTarget = iframe2.contentWindow!;

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(iframe2.contentWindow!);
    expect(messagesReceived.length).to.equal(2);
    expect(messagesReceived[1]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE2 = 'World';
    postdoc.postMessage(MESSAGE2);
    await wait(50);


    iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);

    iframeText2 = checkIframeContent(iframe2);
    expect(iframeText2).to.equal(MESSAGE2);
  });

  it('two iframes and two postdocs', async () => {
    const messagesReceived: string[] = [];
    const messagesReceived2: string[] = [];

    const onMessageFactory =
      (messagesReceived: string[]) => (event: MessageEvent) => {
        messagesReceived.push(event.data);
      };
    let resolveLoaded = (_value?: unknown) => {};
    let resolveLoaded2 = (_value?: unknown) => {};

    postdoc = new PostDoc({
      inferTarget: false,
      onMessage: onMessageFactory(messagesReceived),
      messageReceiver: window,
    });

    postdoc2 = new PostDoc({
      inferTarget: false,
      onMessage: onMessageFactory(messagesReceived2),
      messageReceiver: window,
    });

    const loaded = new Promise((res) => {
      resolveLoaded = res;
    });

    const loaded2 = new Promise((res) => {
      resolveLoaded2 = res;
    });

    const iframes = await fixture<HTMLDivElement>(html`
      <div>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded()}
        ></iframe>
        <iframe
          src="/src/test/frame-code/frame.html"
          @load=${() => resolveLoaded2()}
        ></iframe>
      </div>
    `);

    const iframe = iframes.querySelector('iframe')!;
    const iframe2 = iframes.querySelectorAll('iframe')[1];

    await Promise.all([loaded, loaded2]);
    // Purposefully miss the initial handshake
    await wait(50);

    postdoc.messageTarget = iframe.contentWindow!;
    postdoc2.messageTarget = iframe2.contentWindow!;

    await postdoc.handshake;
    await wait(50);

    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);
    expect(messagesReceived2.length).to.equal(1);
    expect(messagesReceived2[0]).to.equal(FRAME_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    const MESSAGE2 = 'World';
    postdoc.postMessage(MESSAGE);
    postdoc2.postMessage(MESSAGE2);
    await wait(50);

    const iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);

    const doc2 = iframe2.contentDocument!;
    const messageDiv2 = doc2.querySelector('div');
    expect(messageDiv2).to.be.ok;
    expect(messageDiv2!.textContent).to.equal(MESSAGE2);
  });

  it('reload iframe', async () => {
    const messagesReceived: string[] = [];

    const onMessageFactory =
      (messagesReceived: string[]) => (event: MessageEvent) => {
        messagesReceived.push(event.data);
      };

    postdoc = new PostDoc({
      onMessage: onMessageFactory(messagesReceived),
      messageReceiver: window,
      inferTarget: true
    });

    const load = new ResettablePromise();

    const iframe = await fixture<HTMLIFrameElement>(html`
      <iframe
        src="/src/test/frame-code/frame.html"
        @load=${() => load.resolve()}
      ></iframe>
    `);

    await postdoc.handshake;
    await wait(50);

    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(FRAME_INITIAL_MESSAGE);

    let iframeText = checkIframeContent(iframe);
    expect(iframeText).to.be.null;

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE);

    load.reset();
    iframe.contentWindow!.location.reload();
    await load.completed;
    await wait(50);

    expect(messagesReceived.length).to.equal(2);
    expect(messagesReceived[1]).to.equal(FRAME_INITIAL_MESSAGE);

    iframeText = checkIframeContent(iframe);
    expect(iframeText).to.be.null;

    const MESSAGE2 = 'World';
    postdoc.postMessage(MESSAGE2);
    await wait(50);

    iframeText = checkIframeContent(iframe);
    expect(iframeText).to.equal(MESSAGE2);
  });

  afterEach(() => {
    fixtureCleanup();
    if (postdoc) {
      destroyPostdoc(postdoc);
    }

    if (postdoc2) {
      destroyPostdoc(postdoc2);
    }
  });
});
