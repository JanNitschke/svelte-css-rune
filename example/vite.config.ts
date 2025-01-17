import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import "svelte-css-rune";
import "svelte";


export default defineConfig({
	plugins: [sveltekit()]
});
