import { expect, fixtureCleanup } from '@open-wc/testing';
import { PostDoc } from '../postdoc';
import { INITIAL_MESSAGE as WORKER_INITIAL_MESSAGE, wait, destroyPostdoc, ResettablePromise, WorkerTestFixture } from './util.js';

describe('worker and host', () => {
  let postdoc: PostDoc;
  let postdoc2: PostDoc;
  let workerFixture: WorkerTestFixture;
  let workerFixture2: WorkerTestFixture;

  before(function() {
    // Firefox does not support module workers and I'm too lazy to bundle
    // and it seems impossible to feature detect the "syntax" error in a worker
    if (navigator.userAgent.includes('Firefox')) {
      this.skip();
    }
  })

  beforeEach(() => {
    postdoc = undefined as unknown as PostDoc;
    postdoc2 = undefined as unknown as PostDoc;
    workerFixture = undefined as unknown as WorkerTestFixture;
    workerFixture2 = undefined as unknown as WorkerTestFixture;
  });

  it('sets up and handshakes', async () => {
    const messagesReceived: string[] = [];
    const worker = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    workerFixture = new WorkerTestFixture(worker);

    postdoc = new PostDoc({
      messageReceiver: worker,
      messageTarget: worker,
      onMessage: (event: MessageEvent) => {
        messagesReceived.push(event.data);
      },
    });

    await postdoc.handshake;
    await wait(50);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(WORKER_INITIAL_MESSAGE);
    expect(postdoc.messageTarget).to.equal(worker);
  });

  it('it posts via constructor', async () => {
    const messagesReceived: string[] = [];
    const worker = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    workerFixture = new WorkerTestFixture(worker);

    postdoc = new PostDoc({
      messageReceiver: worker,
      messageTarget: worker,
      onMessage: (event: MessageEvent) => {
        messagesReceived.push(event.data);
      },
    });

    await postdoc.handshake;

    expect(workerFixture.receivedMessages.length).to.equal(0);
    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);

    await wait(50);
    expect(workerFixture.receivedMessages.length).to.equal(1);
    expect(workerFixture.receivedMessages[0]).to.equal(MESSAGE);
  });

  it('handshakes and posts when set up via props', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };
    const worker = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    workerFixture = new WorkerTestFixture(worker);

    // Purposefully miss the initial handshake
    await wait(100);

    postdoc = new PostDoc();
    postdoc.messageReceiver = worker;
    postdoc.messageTarget = worker;
    postdoc.onMessage = onMessage;

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageReceiver).to.equal(worker);
    expect(postdoc.messageTarget).to.equal(worker);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(WORKER_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    expect(workerFixture.receivedMessages.length).to.equal(1);
    expect(workerFixture.receivedMessages[0]).to.equal(MESSAGE);
  });

  it('switching workers', async () => {
    const messagesReceived: string[] = [];
    const onMessage = (event: MessageEvent) => {
      messagesReceived.push(event.data);
    };

    const worker = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    const worker2 = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    workerFixture = new WorkerTestFixture(worker);
    workerFixture2 = new WorkerTestFixture(worker2);

    postdoc = new PostDoc({
      inferTarget: false,
      onMessage,
      messageReceiver: worker,
      messageTarget: worker,
    });

    expect(postdoc.messageTarget).to.equal(worker);

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(worker);
    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(WORKER_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    postdoc.postMessage(MESSAGE);
    await wait(50);

    expect(workerFixture.receivedMessages.length).to.equal(1);
    expect(workerFixture.receivedMessages[0]).to.equal(MESSAGE);

    expect(workerFixture2.receivedMessages.length).to.equal(0);

    // switch targets
    postdoc.messageReceiver = worker2;
    postdoc.messageTarget = worker2;

    await postdoc.handshake;
    await wait(50);

    expect(postdoc.messageTarget).to.equal(worker2);
    expect(messagesReceived.length).to.equal(2);
    expect(messagesReceived[1]).to.equal(WORKER_INITIAL_MESSAGE);

    const MESSAGE2 = 'World';
    postdoc.postMessage(MESSAGE2);
    await wait(50);

    expect(workerFixture.receivedMessages.length).to.equal(1);
    expect(workerFixture.receivedMessages[0]).to.equal(MESSAGE);

    expect(workerFixture2.receivedMessages.length).to.equal(1);
    expect(workerFixture2.receivedMessages[0]).to.equal(MESSAGE2);

    // switch back to initial target
    postdoc.messageReceiver = worker;
    postdoc.messageTarget = worker;

    await postdoc.handshake;
    const MESSAGE3 = 'Hello again';
    postdoc.postMessage(MESSAGE3);

    await wait(50);
    expect(workerFixture.receivedMessages.length).to.equal(2);
    expect(workerFixture.receivedMessages[1]).to.equal(MESSAGE3);

    expect(workerFixture2.receivedMessages.length).to.equal(1);
    expect(workerFixture2.receivedMessages[0]).to.equal(MESSAGE2);
  });

  it('two workers and two postdocs', async () => {
    const messagesReceived: string[] = [];
    const messagesReceived2: string[] = [];

    const onMessageFactory =
      (messagesReceived: string[]) => (event: MessageEvent) => {
        messagesReceived.push(event.data);
      };

    const worker = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    const worker2 = new Worker('/lib/test/worker-code/worker.js', { type: 'module' });
    workerFixture = new WorkerTestFixture(worker);
    workerFixture2 = new WorkerTestFixture(worker2);

    postdoc = new PostDoc({
      inferTarget: false,
      onMessage: onMessageFactory(messagesReceived),
      messageReceiver: worker,
      messageTarget: worker,
    });

    postdoc2 = new PostDoc({
      inferTarget: false,
      onMessage: onMessageFactory(messagesReceived2),
      messageReceiver: worker2,
      messageTarget: worker2,
    });

    await postdoc.handshake;
    await wait(50);

    expect(messagesReceived.length).to.equal(1);
    expect(messagesReceived[0]).to.equal(WORKER_INITIAL_MESSAGE);
    expect(messagesReceived2.length).to.equal(1);
    expect(messagesReceived2[0]).to.equal(WORKER_INITIAL_MESSAGE);

    const MESSAGE = 'Hello';
    const MESSAGE2 = 'World';
    postdoc.postMessage(MESSAGE);
    postdoc2.postMessage(MESSAGE2);
    await wait(50);

    expect(workerFixture.receivedMessages.length).to.equal(1);
    expect(workerFixture.receivedMessages[0]).to.equal(MESSAGE);

    expect(workerFixture2.receivedMessages.length).to.equal(1);
    expect(workerFixture2.receivedMessages[0]).to.equal(MESSAGE2);
  });

  afterEach(() => {
    fixtureCleanup();
    if (postdoc) {
      destroyPostdoc(postdoc);
    }

    if (postdoc2) {
      destroyPostdoc(postdoc2);
    }

    if (workerFixture) {
      workerFixture.destroy();
    }

    if (workerFixture2) {
      workerFixture2.destroy();
    }
  });
});
