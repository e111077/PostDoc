import {PostDoc} from '../../postdoc.js';
import {render, html} from 'lit';
import { INITIAL_MESSAGE } from '../util.js';

export const run = async () => {
  const onMessage = (event:MessageEvent) => {
    render(html`<div>${event.data}</div>`, document.body);
  };

  const postdoc = new PostDoc({
    messageTarget: window.top!,
    messageReceiver: window,
    onMessage,
  });

  await postdoc.handshake;
  postdoc.postMessage(INITIAL_MESSAGE);
}