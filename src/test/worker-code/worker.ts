import {PostDoc} from '../../postdoc.js';
import { INITIAL_MESSAGE } from '../util.js';

export const run = async () => {

  const onMessage = (event:MessageEvent) => {
    self.postMessage(['WORKER_RECEIVED_MESSAGE', event.data]);
  };

  const postdoc = new PostDoc({
    messageTarget: self,
    messageReceiver: self,
    onMessage,
  });

  await postdoc.handshake;
  postdoc.postMessage(INITIAL_MESSAGE);
}

run();