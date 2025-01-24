import App from './App.svelte';

const production = process.env.NODE_ENV === 'production';
const basePath = production ? '/unsmurf/' : '/';

const app = new App({
	target: document.body,
	props: {
		name: 'world',
		basePath, // Pass the base path as a prop
	}
});

export default app;
