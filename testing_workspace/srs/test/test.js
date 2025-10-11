const res = await fetch(
	`https://api.cloudflare.com/client/v4/accounts/ec758d282b2c89b4a1a147b64f445849/autorag/rags/solar-install/ai-search`,
	{
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer NhQdSUiyJY2UFErA3xkcEsPN_IwWB4Z1hPx-KWXV`,
		},
		body: JSON.stringify({ query: 'Installation steps for solar panel model X100' }),
	},
);
const data = await res.json();
console.log(data);
