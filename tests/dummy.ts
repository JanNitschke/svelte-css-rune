export const hash = () => "hash";

export const source = `<script module>
	export const test = $css("test3");
</script>
<script>
	const test = $css("test");
</script>
<span class={$css("test2")}>test</span>`.trim();;


export const used = `<script>
  const d = "f";
  const test2 = $css("test2");
  const test3 = $css("test3");
  const test = $css("test");
</script>
<span class="test" class:test6={test2} >test</span>
<span class={{"test8": true, test9: false}}>test</span>
<span class={["test4"]}>test</span>`.trim();


export const child = `<Test class={$css("test")} buttonClass={$css("test3")} />`.trim();

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
</style>`.trim();