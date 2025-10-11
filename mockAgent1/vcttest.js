import fetch from 'node-fetch';

const ACCOUNT_ID = 'ec758d282b2c89b4a1a147b64f445849';
const INDEX_NAME = 'my-768-cosine-index';
const TOKEN = 'NhQdSUiyJY2UFErA3xkcEsPN_IwWB4Z1hPx-KWXV';

const url = `https://api.cloudflare.com/client/v4/accounts/ec758d282b2c89b4a1a147b64f445849/vectorize/indexes/my-768-cosine-index/upsert`;

const body = {
  vectors: [
    {
      id: 'ping',
      values: Array(768).fill(0.1), // exactly 768 floats
    },
  ],
};

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer NhQdSUiyJY2UFErA3xkcEsPN_IwWB4Z1hPx-KWXV`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

console.log(await res.text());
