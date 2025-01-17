<script module>
</script>


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

<style>\n\n:global(.test-hash){\n  color: red;\n}\n:global(.test2-hash){\n  color: blue;\n}\n:global(.test3-hash){ \n  color: rebeccapurple;\n}\n.test4{ \n  color: orange;\n}\n.unused{\n  color: green;\n}\n\n.unused :global(.test-hash){\n  color: yellow;\n}\n</style>
<style>\n\n.test{\n  color: red;\n}\n.test2{\n  color: blue;\n}\n.test3{ \n  color: rebeccapurple;\n}\n.test4{ \n  color: orange;\n}\n.unused{\n  color: green;\n}\n\n.unused .test{\n  color: yellow;\n}\n</style>