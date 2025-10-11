const answer = await env.AI.autorag('solar-install').aiSearch({
	query: 'installation',
});

console.log('Answer:', answer);
