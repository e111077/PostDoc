<h1 align="center">PostDoc</h1>
<p align="center">
  <a href="https://www.youtube.com/watch?v=ZFtyh-5LPxw">
    <i>Doctors shake hands a lot, why not JS libraries?</i>
  </a>
</p>

[![Build Status](https://github.com/e111077/PostDoc/actions/workflows/tests.yml/badge.svg)](https://github.com/e111077/PostDoc/actions/workflows/tests.yml)
[![Published on npm](https://img.shields.io/npm/v/postdoc-lib.svg?logo=npm)](https://www.npmjs.com/package/postdoc-lib)
[![Downloads](https://img.shields.io/npm/dm/postdoc-lib.svg?logo=npm)](https://www.npmjs.com/package/postdoc-lib)
[![License](https://img.shields.io/npm/l/postdoc-lib.svg?logo=npm)](https://www.npmjs.com/package/postdoc-lib)
[![Version](https://img.shields.io/npm/v/postdoc-lib.svg?logo=npm)](https://www.npmjs.com/package/postdoc-lib)
![GitHub stars](https://img.shields.io/github/stars/e111077/PostDoc.svg?style=social)

## Overview

A PostDoc JS library that simplifies message passing between iframes, web workers, or
anything that has a `postMessage` interface and and offers multiple handshakes.

Initially created to simplify communication with an iframe that reloads often.

## Getting Started

### Install

```sh
npm i postdoc-lib
```

### Usage

Postdoc must be instantiated in both ends. e.g. Main Window and iframe or
Main Window and Web Worker.

This is an example of how you would set up postdoc in the host window:
```ts
// In main window
import { PostDoc } from 'postdoc';

(async () => {
  const onMessage = (e: MessageEvent) => {
    console.log(`Parent received message: ${e.data}`);
  };

  const postdoc = new PostDoc({
    // Where to listen for handshake messages
    messageReceiver: window,
    // [optional] origin used for postMessage for Window targets
    origin: 'https://my-domain.com',
    onMessage
  });

  await postdoc.handshake;
  postdoc.postMessage('Message from parent');
})()
```

This is how you would set up postdoc in an iframe that reloads often:
```ts
// In iframe that reloads often
import { PostDoc } from 'postdoc';

(async () => {
  const onMessage = (e: MessageEvent) => {
    console.log(`iframe received message: ${e.data}`);
  };

  const postdoc = new PostDoc({
    // Where to listen for handshake messages
    messageReceiver: window,
    messageTarget: window.top!,
    onMessage
  });

  await postdoc.handshake;
  postdoc.postMessage('Message message from iframe');
})()
```

## API

### Properties

| Property | Type | Description |
| -------- | ---- | ----------- |
| `handshake` | `Promise<PostDoc>` | Promise that resolves when the pairing is complete between the given PostDoc instance and the instance at the other end of the `messageTarget` |
| `onMessage` | `<T = unknown>(message: MessageEvent<T>) => unknown`| The function to be called when a message is received from the paired PostDoc |
| `messageReceiver` | `MessageReceiver\|null`<sup>*</sup> | The source that should be listened to for hanshake messages. e.g. `winow` when communicating with an iframe that will post on `window.top` or `Worker` when communicating with a worker that will post on `self` |
| `messageTarget` | `PostMessageTarget\|null`<sup>\*\*</sup> | The target for handhsake messages. If `inferTarget`<sup>\*\*\*</sup> is `true` and `messageTarget` is omitted, `messageTarget` will be set to the first `MessageEventSource` that fires a handshake message to the given `messageReceiver`. **NOTE:** If handshake message is fired to receiver before PostDoc is instantiated, the handshake will not resolve. This can be prevented in most cases by setting `messageTarget` in both message sources. Additionally, `messageReceiver` should be set before `messageTarget` or set in the constructor. |

\* See [MessageReceiver](#messagereceiver) for more information.

\*\* `PostMessageTarget` is a [`MessageEventSource`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent/source) which is a `WindowProxy`,`MessagePort`, or a `ServiceWorker` object.

\* See `inferTarget` in [MessageReceiver](#messagereceiver) for more information.

### Methods

| Method | Signature | Description |
| ------ | --------- | ----------- |
| _constructor_ | `constructor(config?: PosdocConfig)`<sup>*</sup> | Constructs the Postdoc instance |
| `postMessage` | `postMessage<T = unknown>(message: T, options?: StructuredSerializeOptions)` | Posts a message to the paired postdoc instance. **NOTE:** await `postdoc.handshake` to ensure that postdoc pairing is complete and ready for postMessage |

\* See [PostdocConfig](#postdocconfig) for more information.

### MessageReceiver

`MessageReceiver` is an interface that is common with objects such as `Window`,
`Worker`, `ServiceWorker`, etc. The interface has the following structure:

| Member | Type      |
| ------ | --------- |
| `addEventListener` | `typeof Window.prototype.addEventListener` |
| `removeEventListener` | `typeof Window.prototype.removeEventListener` |

### PostdocConfig

`PostdocConfig` is the type of the object that is passed to the constructor.

| Member | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `origin` | `string` | `'*'` | The origin used for postMessage for Window targets |
| `onMessage` | `<T = unknown>(message: MessageEvent<T>) => unknown` | `() => {}` | See `onMessage` in [Properties](#properties) for more information. |
| `inferTarget` | `boolean` | `false` | If `true`, and `messageTarget` is not defined, the `messageTarget` will be inferred to be the first `MessageEventSource` that fires a handshake message to the given `messageReceiver`. If `false`, `messageTarget` must be set by the user. |
| `messageTarget` | `PostMessageTarget|undefined` | `undefined` | See `messageTarget` in [Properties](#properties) for more information. |
| `messageReceiver` | `MessageReceiver|undefined` | `undefined` | See `messageReceiver` in [Properties](#properties) for more information. |

## Contribution

### Development

Start the build an start the server:

```sh
npm run dev
```

### Testing

To run the tests:

```sh
npm run build
npm run test
```

To Dev with the tests, run `npm run dev` in one terminal and the following command in another:

```sh
npm run test:watch
```