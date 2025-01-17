<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		children?: Snippet;
		class?: string;
		buttonClass?: string;
		onclick?: () => void;
	}
	let { children, class: className, onclick, buttonClass }:Props = $props();

</script>

<div class={className}>
  {@render children?.()}
  <button class={buttonClass} on:click={onclick}>Click me</button>
</div>

<style>

</style>