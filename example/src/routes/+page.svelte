<script lang="ts">
	import Test from "../components/test.svelte";
	let clicked = $state(false);

	console.log($css("test"));
</script>

<Test class={$css("test")} buttonClass={clicked?$css("buttonTest2"):$css("buttonTest")} onclick={() => clicked = !clicked} />
<span class="test">T</span>
<div class="container"> 
	<Test class={$css("test")} buttonClass={clicked?$css("buttonTest2"):$css("buttonTest")} onclick={() => clicked = !clicked} />
</div>

<style lang=scss>
	.test {
		background-color: red;
	}
	.buttonTest2 {
		color: yellow;
	}
	.buttonTest {
		color: blue;
	}
	.container {
		.test{
			background-color: green;
		}
		.buttonTest {
			color: purple;
		}
	}
</style>