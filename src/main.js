import App from './app.svelte'; // Change import from App to NewApp

const app = new App({
	target: document.body,
	props: {
		name: 'world'
	}
});

export default app;