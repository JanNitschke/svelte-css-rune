# svelte-css-rune

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dist/esm/index.js
```

This project was created using `bun init` in bun v1.1.43. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.





# Typescript 

This library has full typescript support. It provides a global declaration for the $css rune. If this is not working automatically for your setup
you should reference this package in a .d.ts file in your project. The default SvelteKit app comes with src/app.d.ts. Just add:
```typescript
/// <reference types="svelte-css-rune" />

```
to the top of this file.

Alternatively you can also add this package to the types field in your package json, or add 
```typescript
import type {} from "svelte-css-rune";

```
to every file that uses the rune.


# Limitations

### The preprocessor will detect this and warn you. If you are not send here by the warning you can ignore this section because you will probably not run into this,

## Rules combining multiple classes with mixed usage

CSS rules combining multiple selectors that are used natively by svelte and with the $css rune can lead to unintended behavior. The preprocessor will emit a warning when it detects this usage. Its best to use the $css rune on all occurrences of a class in a file. 


## What this issue looks like

When writing a component with mixed usage like this:
```svelte
<div class="outer">
	<div class={$css("inner")}>
	</div> 
</div> 
<div class={$css("outer")}>
	<div class={$css("inner")}>
	</div> 
</div>
<style>
	.outer .inner{
		color: red;
	}
</style>
```

Everything works fine. This is compiled to:
```svelte
<div class="outer">
	<div class={"inner-1oseexr"}>
	</div> 
</div> 
<div class={"outer-1oseexr"}>
	<div class={"inner-1oseexr"}>
	</div> 
</div>
<style>
	:global(.outer-1oseexr) :global(.inner-1oseexr){
		color: red;
	}
	.outer :global(.inner-1oseexr){
		color: red;

	}
</style>
```
All classes work as expected, the rule has been duplicated to accommodate the mixed usage. This works because only one of the classes, outer, is used with the rune and native. This brakes if we add native usage of the inner class:

```svelte
<div class="outer">
	<div class={$css("inner")}>
	</div> 
</div> 
<div class={$css("outer")}>
	<div class="inner">
	</div> 
</div>
<style>
	.outer .inner{
		color: red;
	}
</style>
```
### Breaks! This is compiled to:
```svelte
<div class="outer">
	<div class={"inner-1oseexr"}>
	</div> 
</div> 
<div class={"outer-1oseexr"}>
	<div class="inner">
	</div> 
</div>
<style>
	:global(.outer-1oseexr) :global(.inner-1oseexr){
		color: red;
	}
	.outer .inner{
		color: red;
	}
</style>
```
Notice how there is no rule that matches anymore! This issue should not occur in most codebases, as its better to not mix usage of classes between runes and native. The preprocessor will warn you whenever this occurs, but the warning is not very specific. 

```svelte
<div class={$css("outer")}>
	<div class={$css("inner")}>
	</div> 
</div> 
<div class="outer">
	<div class="inner">
	</div> 
</div>
<style>
	.outer .inner{
		color: red;
	}
</style>
```
Will cause the same warning, but is completely fine. Its a good idea to avoid this anyway as this can easily lead to the same issue later. 

### How to fix it

Just wrap all usages of these classes with the $css rune. Creating a renamed copy of one class and replacing only native or rune references to it works to.