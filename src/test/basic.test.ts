import { expect } from '@open-wc/testing';
import { PostDoc } from '../postdoc.js';
import { destroyPostdoc } from './util.js';

interface PostDocInternal {
  _origin: string;
  _inferTarget: boolean;
}

describe('Basic Setup', () => {
  let postdoc: PostDoc;

  beforeEach(() => {
    postdoc = undefined as unknown as PostDoc;
  });

  it('instantiates without error', async () => {
    postdoc = new PostDoc();
    expect(postdoc).to.be.instanceOf(PostDoc);
  });

  it('default values are set correctly', async () => {
    postdoc = new PostDoc();
    expect((postdoc as unknown as PostDocInternal)._origin).to.equal('*');
    expect((postdoc as unknown as PostDocInternal)._inferTarget).to.equal(false);
    expect(postdoc.messageReceiver).to.equal(null);
    expect(postdoc.messageTarget).to.equal(null);
    expect(postdoc.onMessage).to.be.ok;
    expect(postdoc.onMessage).to.be.instanceOf(Function);
    expect(postdoc.handshake).to.be.instanceOf(Promise);
  });

  it('constructor sets values correctly', async () => {
    const messageTarget = {
      postMessage: (_message: any, _targetOrigin: string) => {},
    } as MessageEventSource;

    const messageReceiver = window;

    const onMessage = (_message: MessageEvent<string>) => true;

    postdoc = new PostDoc({
      origin: '*',
      inferTarget: true,
      messageReceiver,
      messageTarget,
      onMessage,
    });

    expect((postdoc as unknown as PostDocInternal)._origin).to.equal('*');
    expect((postdoc as unknown as PostDocInternal)._inferTarget).to.equal(
      true
    );
    expect(postdoc.messageReceiver).to.equal(messageReceiver);
    expect(postdoc.messageTarget).to.equal(messageTarget);
    expect(postdoc.onMessage).to.equal(onMessage);
  });

  afterEach(() => {
    if (postdoc) {
      destroyPostdoc(postdoc);
    }
  });
});