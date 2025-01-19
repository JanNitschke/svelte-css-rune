<script lang="ts">
	import type { Snippet } from 'svelte';
	
	let { children, class: className, onclick, buttonClass }:Props = $props();
	interface Props {
		children?: Snippet;
		class?: string;
		buttonClass?: string;
		onclick?: () => void;
	}
</script>

<div class={className}>
  {@render children?.()}
  <button class={buttonClass} on:click={onclick}>Click me</button>
</div>
