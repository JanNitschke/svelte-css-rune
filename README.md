# svelte-css-rune

[![npm version](https://img.shields.io/npm/v/svelte-css-rune.svg)](https://www.npmjs.com/package/svelte-css-rune)
[![npm downloads](https://img.shields.io/npm/dm/svelte-css-rune.svg)](https://www.npmjs.com/package/svelte-css-rune)
[![Test Status](https://img.shields.io/github/actions/workflow/status/JanNitschke/svelte-css-rune/test.yml?branch=main)](https://github.com/JanNitschke/svelte-css-rune/actions)


**`svelte-css-rune` is a Svelte library that allows you to effortlessly pass styles between components by introducing a new `$css` rune.**

Svelte provides an elegant way to scope styles to components, but passing styles between parent and child components can be challenging. There's no built-in mechanism for this, often leading to workarounds like declaring classes as global and carefully managing potential naming conflicts. This library introduces a simple way to pass styles between components. It solves the problem of style conflicts and promotes better style encapsulation when working with nested components.

The `$css` rune creates a globally unique class name for a given class, ensuring that it is unique to the file and the original class name. The style tag is modified to use the generated class name, and the class is made globally accessible with the `:global` selector. If the same class is used both with the `$css` rune and without it, the preprocessor respects both usages, ensuring that the styles are applied correctly.

`svelte-css-rune` does not support css nesting. If you want to use css nesting please use a preprocessor that compiles this to normal css, ex. scss.

## Example

Child.svelte
```svelte
<script>
	let {containerClass, buttonClass} = $props();
</script>

<div class={containerClass}>
	<button class={buttonClass}></button>
</div>
```
Parent.svelte
```svelte
<script>
	import Child from "./Child.svelte"
</script>

<Child containerClass={$css("container")} buttonClass={$css("button")} />

<style>
	.container{
		background: rebeccapurple;
	}
	.button{
		color: white;
	}
</style>
```

### Use with component libraries

This library was designed for component libraries. Effortlessly customize the style of your components!

#### Customizing Existing Components

```svelte
<script lang="ts">
  import { Button } from "bits-ui";
</script>

<Button.Root class={$css("button")}>
  Unlimited
</Button.Root>

<style>
  .button {
	color: red;
  }
</style>
```

#### Creating Customizable Components

Popup.svelte
```svelte
<script>
  let {cardClass, buttonClass} = $props();
</script>
<div class={["card",cardClass]} >
  <button class={["button",containerClass]} />
</div>
<style>
  .card{
	// Your default styles
  }
  .button{
	// Your default styles
  }
</style>
```


Usage.svelte
```svelte
<script>
  let {containerClass, buttonClass} = $props();
</script>

<Popup containerClass={$css("container")} buttonClass={$css("button")} />

<style>
  .container{
	// Additional styles
  }
  .button{
	flex-grow: 1;
  }
</style>
```
# Install

### **Svelte 5** is required, but it is compatible with both rune and legacy syntaxes. 

1) Add `svelte-css-rune` as devDependency. Use the appropriate command for your package manager:
	```bash
	npm install --save-dev svelte-css-rune
	```
	```
	bun add --dev svelte-css-rune
	```
	```bash
	yarn add --dev svelte-css-rune
	```
	```bash
	pnpm add -D svelte-css-rune
	```
2) Add the preprocessor to your Svelte configuration. This is usually in `svelte.config.js`/`ts`, but can also be in `rollup.config.js`/`ts` or `vite.config.js`/`ts`. SvelteKit uses a `svelte.config.js`/`ts` file. 
	```javascript
	import cssRune from "svelte-css-rune";
	export default {
		preprocess: cssRune(),
		// Rest of the config
		}
	```
	If you are using other preprocessors, such as `svelte-preprocess`, you can pass an array of preprocessors. 

	**The order is important**: `svelte-css-rune` should be the **LAST** one in the array."
	```javascript
	import cssRune from "svelte-css-rune";
	import preprocess from "svelte-preprocess";
	export default {
		preprocess: [preprocess(), cssRune()],
		// Rest of the config
	}
	```

3) You can pass options to the preprocessor. For a list of options see the [Options](#Options) section. 
	```javascript
	import cssRune from "svelte-css-rune";
	export default {
		preprocess: cssRune({
			mixedUseWarnings: true,
			increaseSpecificity: true
		}),
		// Rest of the config
	}
	```
4) Use the `$css` rune in your components. 


See the [Typescript](#Typescript) section for typescript support.
You can find a svelte kit example in the [example](example) folder.

# Options

The preprocessor can be configured with the following options:

- `mixedUseWarnings` (default: `"use"`): Emit warnings when a class is used with the $css rune and without it. Setting this to `true` will warn on mixed usage in script tags, markup and when defining mixed css rules. Setting it to `"use"` will not warn when defining mixed css rules. Setting it to `false` will disable all warnings.

- `hash` can be used to override the hash function. Expects a function that takes a string and returns a string. The default hash function is the same svelte uses.

- `increaseSpecificity` if true the generated class will be a combined class selector that has higher specificity then svelte native class selectors.
  Set this to true if you want to override local styles with rune styles.

# How it works and advanced usage

The `$css` rune is a function that takes a **string literal** as an argument. The rune is replaced with a unique class name that is generated by the preprocessor. This class name is unique to the file and the original name, preventing naming conflicts when passing styles between components. It modifies class names within style tags to match the generated names and utilizes the `:global` selector to make these generated classes globally accessible. It only affects classes that are referenced with the `$css` rune. Classes used both with the `$css` rune and natively (i.e., directly within the class attribute without the rune) are duplicated. This should be avoided as it results in larger bundle sizes and can potentially cause issues. The preprocessor will warn you if such an issue ever occurs.

## Usage
You can use the `$css` rune inside script tags, script module tags, and within the markup. It integrates seamlessly with all Svelte style features, including the new `clsx` integration. It's statically replaced with the generated class name. The content of the `$css` rune must be a string literal; unquoted strings are not supported. The preprocessor will issue a warning if the `$css`rune is used in an unsupported way.

```svelte
<script module>
	export const globalClassName = $css("my-class");
</script>
<script>
	let className = $css("my-class");
	let {dark, bold} = $props();
</script>

<div class={myClass}></div>

<!-- You can use it directly within the markup -->
<div class={$css("my-class")}></div>
<!-- You can combine it with native usage of the same class within the same file -->
<div class="my-class">

<!-- You can pass multiple classes at once -->
<Button class={$css("button dark")} />

<!-- Works with ternary expressions -->
<Button class={dark?$css("dark"):$css("light")}></Button>

<!-- Works with clsx syntax -->
<Button class={[dark && $css("dark"), bold && $css("bold")]}></Button>

<!-- No need to modify the style tag; it works with other preprocessors like Sass -->
<style>
	.my-class{
		color: red;
	}
	.button{
		color: blue;
	}
	.dark{
		background: black;
	}
	.light{
		background: black;
	}
	.bold{
		font-weight: bold;
	}
</style>
```

### Errors and Warnings

This preprocessor does not interfere with or disable Svelte's unused class warnings. It will produce an error if the `$css` rune is misused or references a non-existent class. Error messages are descriptive and pinpoint the exact location of the issue.

```
/example/Component.svelte

202| });
203|
204| const className = $css("i-dont-exist")
                       ^^^^^^^^^^^^^^^^^^^^
                class i-dont-exist is not defined

```


## Example Transpilation

Consider a component with mixed usage like this:

```svelte
<div class="outer">
	<Child class={$css("inner")}/> 
</div> 
<Child class={$css("child")}/>
<button class="child"/>
<style>
	.outer .inner{
		color: red;
	}
	.child{
		color: blue;
	}
</style>
```

All styles just work! This is compiled to:

```svelte
<div class="outer">
	<Child class={"inner-1oseexr"}/> 
</div> 
<Child class={"child-1oseexr"}/>
<button class="child"/>
<style>
	.outer :global(.inner-1oseexr){
		color: red;
	}
	.child, :global(.child-1oseexr){
		color: blue;
	}
</style>
```
Note the random string appended to the class names. This ensures unique class names. It's generated based on the path and content of the component.

# Typescript 

This library provides full TypeScript support. It provides a global declaration for the `$css` rune. If this is not working automatically for your setup
you should reference this package in a .d.ts file in your project. The default SvelteKit app comes with src/app.d.ts. 

Simply add:

```typescript
/// <reference types="svelte-css-rune" />

```
to the top of this file.

Alternatively, you can add this package to the `types` field in your `tsconfig.json`, or add

```typescript
import type {} from "svelte-css-rune";

```
to every file where the rune is used.


# Edge Cases

Edge cases will only occur when mixing `$css` rune with native class usage. The preprocessor will emit a warning if mixed usage is detected. It will fail if it detects an edge case that it cannot handle.

## Warning: Mixed usage of $css rune and native class

__If you adhere to this warning you will not encounter any of these issues.__



The preprocessor will emit a warning if it detects mixed usage of the `$css` rune and native class usage. This is not recommended, as it can lead to larger bundle sizes and potential issues. This warning can be safely ignored if you are aware of the implications and can be suppressed with the `mixedUseWarnings` option. 
### Note: The following edge cases is unlikely to affect most users. It's included for completeness and transparency. If you haven't been directed here by a warning from the preprocessor, you can likely skip this section.

## Rules with multiple native and $css rune classes (mixed usage only)

Svelte has a limitation on global selectors. Global selectors need to be at the beginning or end of a selector list. This means that a rule like this:

```css	
// NOT OK
.used-with-rune .used-natively .used-with-rune .used-natively {
	color: red;
}
``` 
will not work. The preprocessor will detect this and issue a warning. Non class selectors count as native selectors.
```css	
// NOT OK
.used-with-rune #some-id .used-with-rune div{
	color: red;
}
``` 
If you use :global in the selector you might not get an error from the preprocessor, but from the svelte compiler. 

```css	
// OK
.used-with-rune #some-id .used-with-rune :global(div){
	color: red;
}
// NOT OK
.used-with-rune #some-id .used-with-rune :global(div) .used-natively{
	color: red;
}
``` 
All combinations that respect this will compile correctly. 

```css	
// OK
.used-with-rune .used-with-rune .used-natively #used-natively .used-with-rune .used-rune {
	color: red;
}
```

## Dynamic class names (mixed usage only)

The preprocessors only detects native usage of the class name if known at compile time. If you use a dynamic class name, the preprocessor will not detect it. If you use a class name dynamically and with the $css rune, the preprocessor not duplicate the rule. The dynamic class name will not work anymore. 

```svelte
// NOT OK
<script>
	let dark = false;
	let className = dark?"black":"white";
</script>
<div class={$css("black")}></div>
<div class={className}></div>  
```
This will cause the second div to not have the correct styles. Avoid mixing dynamic class names with the $css rune. 
The preprocessor can handle dynamic class names if they are defined inside the element.

```svelte
// OK
<script>
	let dark = true;
</script>
<div class={$css("black")}></div>
<div class={dark?"black":"white"}></div> 
<!-- OR -->
<div class={{black: dark, white: !dark }}></div> 
```


## Building and Testing

### Building

You can build this library using either Node.js or Bun via the build script. It compiles to both ESM and CommonJS formats.
```bash
npm run build
```
```bash
bun run build
```
### Tests
Bun is required to run the tests.
```bash
bun test
```

This library contains end-to-end tests that verify the functionality of the preprocessor. The transform tests executes the generated svelte components and makes sure the styles are applied correctly.

The walk tests check all stages of the preprocessor to avoid regressions.

All errors and warnings are tested.


# Comparison to svelte-preprocess-cssmodules

[`svelte-preprocess-cssmodules`](https://github.com/micantoine/svelte-preprocess-cssmodules) can be used to archive something similar. However, its primary goal is to provide CSS Modules support, not solely a mechanism for passing classes between components.

It generates unique class names for every class within a style tag, transforming all styles in a file to use these generated names. This involves parsing and replacing a significant portion of your code, essentially replacing Svelte's built-in style handling. It also treats the `class` prop as a special, magical property, and adding other attributes requires global configuration for all components. Furthermore, it disables Svelte's unused class warnings.

`svelte-css-rune` is a significantly simpler library. It only replaces the `$css` rune and the referenced class with a unique class name, leaving other styles untouched.
It aims for simplicity and a seamless integration with the rest of the Svelte 5 syntax. It does not disable Svelte's unused class warnings.

`svelte-preprocess-cssmodules` is a great library if you require more extensive features. This library draws significant inspiration from it.

While I initially created a pull request to add this feature to `svelte-preprocess-cssmodules`, I decided to create this separate library for a more focused and simpler approach. 

# License

[MIT](https://opensource.org/licenses/MIT)
