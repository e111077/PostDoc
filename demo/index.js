import {PostDoc} from '../lib/postdoc.js';

const onMessage = (message) => {
  const output = document.body.querySelector('.output');
  const div = document.createElement('div');
  div.innerText = `Received Message: ${message.data}`;
  output.appendChild(div);
};

const postdoc = new PostDoc({
  messageReceiver: window,
  inferTarget: true,
  onMessage
});

(async() => {
  await postdoc.handshake;
  postdoc.postMessage('Initial Connection Ready!');
})();

document.querySelector('.post').addEventListener('click', async () => {
  await postdoc.handshake;
  postdoc.postMessage('Message from Host!');
});

document.querySelector('.reload').addEventListener('click', () => {
  document.body.querySelector('iframe').contentWindow.location.reload();
});
