import { describe, it, expect } from "bun:test";
import { compile, Processed } from 'svelte/compiler';
import cssRune, { type Options } from '../lib/index';
import { Document, Window, type CSSStyleDeclaration, type Element } from 'happy-dom';
import { render } from 'svelte/server';
import { importFromStringSync } from "module-from-string";
import path from "path";
import { readdirSync, readFileSync } from "fs";

/**
 * @module tests/e2e.test.ts
 * 
 * @desc This Module tests the end-to-end functionality of the preprocessor. Components are transformed and the resulting css is loaded into a DOM.
 * 
 */


/**
 * @constant DEFAULT_OPTIONS
 * 
 * @desc Test options for the preprocessor. 
 */

const DEFAULT_OPTIONS: Partial<Options> = {
};


/**
 * @function transform
 * 
 * @desc This function transforms a svelte component and returns the compiled code.
 */
const transform = (code: string, options:  Partial<Options>) =>	{

	const filename = path.join(__dirname, "environment", "test.svelte");
	const { markup } = cssRune(options);
	const preprocessed = markup({ content: code, filename }) as Processed;

	const compiled = compile(preprocessed.code, { filename, generate: "server" });


	return compiled;

}


/**
 * @function transformEnv
 * 
 * @desc This function transforms all the components in the environment folder and returns a Map that can be used to import them.
 * @param options - The options for the preprocessor
 * @param load - If true, the components are loaded into the environment. If false, only the css is returned.
 */

const transformEnv = (options:  Partial<Options&{env?: string[]}>, load: boolean = true) =>	{
	
	const dirName = path.join(__dirname, "environment");
		const compiledFiles: Record<string, string> = {};
	
	const envCss: string[] = [];

	for (const file of options.env ?? []) {
		const filename = path.join(dirName, file);
		const content = readFileSync(filename, "utf-8");
		const { markup } = cssRune(options);
		const preprocessed = markup({ content, filename }) as Processed;
		const compiled = compile(preprocessed.code, { filename, generate: "server" });
		const exportName = file.replace(".svelte", "");
		envCss.push(compiled.css?.code || "");
		if(load){
				const mod = importFromStringSync(compiled.js.code);
				Object.assign(mod.default, mod);
				compiledFiles[exportName] = mod.default;
		}
	}
	return {env: compiledFiles, css: envCss.join("\n")};
};

/**
 * @function toCSSOnly
 * 
 * @desc This function transforms a svelte component and creates a document with only the css loaded. 
 */
export const toCSSOnly = (code: string, options: Partial<Options&{env?: string[]}> = DEFAULT_OPTIONS) => {
	const combinedOptions = {...DEFAULT_OPTIONS, ...options};
	const {css} = options.env?transformEnv(combinedOptions, false):{ css: ""};
	const compiled = transform(code, combinedOptions);
	const window = new Window({ url: 'https://localhost:8080' });
	const document = window.document;
	if(!compiled.css?.code){
		return {
			document: null,
			getStyle: (node?: Element | null | undefined):CSSStyleDeclaration|null => null
		}
	}
	document.head.appendChild(document.createElement('style')).textContent = compiled.css.code;
	document.head.appendChild(document.createElement('style')).textContent = css;

	return {
		document,
		getStyle: (node?: Element | null | undefined):CSSStyleDeclaration|null => (!node || !(node as any).style)?null: window.getComputedStyle(node as any)
	};
}

/**
 * @function toDOM
 * 
 * @desc This function transforms a svelte component and creates a document with the css and html loaded. Injects the environment components.
 */
export const toDOM = (code: string, options: Partial<Options&{env?: string[]}> = DEFAULT_OPTIONS, receive?: (content: any) => void) => {
	const combinedOptions = {...DEFAULT_OPTIONS, ...options};
	const compiled = transform(code, combinedOptions);
	const window = new Window({ url: 'https://localhost:8080' });
	const document = window.document;
	 
	const {env, css} = options.env?transformEnv(combinedOptions, true):{env: {}, css: ""};

	const send = (content: any) => {
		if(receive){
			receive(content);
		}
	};

	const module = importFromStringSync(compiled.js.code, { globals: { env, console, send } });
	const { body, head } = render(module.default);
	document.head.innerHTML = head;
	if(compiled.css?.code){
		document.head.appendChild(document.createElement('style')).textContent = compiled.css.code;
	}
	document.head.appendChild(document.createElement('style')).textContent = css;
	document.body.innerHTML = body;
	return {
		document,
		getStyle: (node?: Element | null | undefined):CSSStyleDeclaration|null => (!node || !(node as any).style)?null: window.getComputedStyle(node as any)
	};
}

/**
 *	Makes sure the transform function works 
 */
describe("e2e transform", () => {
	it("should transform a component to rendered DOM", () => {
		const code = `
		<style>
			.test {
				color: red;
			}
		</style>
		<div class="test">Hello World</div>
		`;
		const {document, getStyle } = toDOM(code);
		const testDiv = document?.querySelector(".test");
		expect(testDiv).toBeTruthy();
		expect(testDiv?.textContent).toBe("Hello World");
		expect(getStyle(testDiv)?.color).toBe("red");
	});
	it("should transform a component to rendered CSS", () => {
		const code = `
		<style>
			.test {
				color: red;
			}
		</style>
		`;
		const {document} = toCSSOnly(code);
		expect(document).toBeTruthy();
		expect(document?.head.innerHTML).toInclude("(unused)");
	});
	 
	it("should resolve imports from the environment folder", () => {

		const code = `
		<script>
			const { E2E } = env;
		</script>
		<E2E />
		`;
		const {document} = toDOM(code, {env: ["E2E.svelte"]});
		expect(document).toBeTruthy();
		expect(document?.querySelector("#e2e")).toBeTruthy();
	});
	
	it("should receive messages from the component", () => {
		const code = `
		<script>
			send("Hello World");
		</script>
		`;
		let received = "";
		const receive = (content: any) => {
			received = content;
		};
		toDOM(code, DEFAULT_OPTIONS, receive);
		expect(received).toBe("Hello World");
	});

	it("should load child css", () => {

		const code = `
		<script>
			const { E2E } = env;
		</script>
		<E2E />
		`;
		const {document, getStyle} = toDOM(code, {env: ["E2E.svelte"]});
		expect(document).toBeTruthy();
		const child = document?.querySelector("#e2e");
		expect(child).toBeTruthy();
		expect(getStyle(child)?.color).toBe("red");
	});
	
});


