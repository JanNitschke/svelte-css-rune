export const hash = () => "hash";

export const source = `<script module>
	export const test = $css("test3");
</script>
<script>
	const test = $css("test");
</script>
<span class={$css("test2")}>test</span>`.trim();;

export const sourceTransformed = `<script module>
	export const test = "test3-hash";
</script>
<script>
	const test = "test-hash";
</script>
<span class={"test2-hash"}>test</span>`.trim();


export const used = `<script>
  const d = "f";
  const test2 = $css("test2");
  const test3 = $css("test3");
  const test = $css("test");
</script>
<span class="test" class:test6={test2} >test</span>
<span class={{"test8": true, test9: false}}>test</span>
<span class={["test4"]}>test</span>`.trim();

export const usedTransformed = `<script>
  const d = "f";
  const test2 = "test2-hash";
  const test3 = "test3-hash";
  const test = "test-hash";
</script>
<span class="test" class:test6={test2} >test</span>
<span class={{"test8": true, test9: false}}>test</span>
<span class={["test4"]}>test</span>`.trim()

export const child = `<Test class={$css("test")} buttonClass={$css("test3")} />`.trim();

export const childTransformed = `<Test class={"test-hash"} buttonClass={"test3-hash"} />`.trim();

export const baseStyles = `<style>

.test{
  color: red;
}
.test2{
  color: blue;
}
.test3{ 
  color: rebeccapurple;
}
.test4{ 
  color: orange;
}
.unused{
  color: green;
}

.unused .test{
  color: yellow;
}
</style>`.trim();;

export const baseStylesTransformed = `<style>

:global(.test-hash){
  color: red;
}
:global(.test2-hash){
  color: blue;
}
:global(.test3-hash){ 
  color: rebeccapurple;
}
.test4{ 
  color: orange;
}
.unused{
  color: green;
}

.unused :global(.test-hash){
  color: yellow;
}
</style>`.trim();

export const baseStylesTransformedUsed = `<style>

:global(.test-hash){
  color: red;
}
.test{
  color: red;
}
:global(.test2-hash){
  color: blue;
}
:global(.test3-hash){ 
  color: rebeccapurple;
}
.test4{ 
  color: orange;
}
.unused{
  color: green;
}

.unused :global(.test-hash){
  color: yellow;
}
.unused .test{
  color: yellow;
}
</style>`.trim();