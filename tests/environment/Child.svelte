<script>
	let { class: className, buttonClass } = $props();
</script>

<div class={className} id="child-component">
	<button class={buttonClass} id="child-button">Click me</button>
</div>