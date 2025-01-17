<script lang="ts">
	import Test from "../components/test.svelte";
	let clicked = $state(false);
</script>

<Test class={$css("test")} buttonClass={clicked?$css("buttonTest2"):$css("buttonTest")} onclick={() => clicked = !clicked} />
<span class="test">T</span>


<style>
	.test {
		background-color: red;
	}
	.buttonTest2 {
		color: yellow;
	}
	.buttonTest {
		color: blue;
	}
</style>