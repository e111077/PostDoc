import { PostDoc } from '../lib/postdoc.js';

if (window === window.top) {
  document.body.innerHTML =
    `This is not in an iframe! Navigate to
    <a href="./index.html">demo/index.html</a> to see this in action.`
}
const onMessage = (message) => {
  const output = document.body.querySelector('.output');
  const div = document.createElement('div');
  div.innerText = `Received Message: ${message.data}`;
  output.appendChild(div);
};

const postdoc = new PostDoc({
  messageReceiver: window,
  messageTarget: window.top,
  onMessage,
});

(async () => {
  await postdoc.handshake;
  postdoc.postMessage('Initial Connection Ready!');
})();

document.querySelector('.post').addEventListener('click', async () => {
  await postdoc.handshake;
  postdoc.postMessage('Message from iframe!');
});
