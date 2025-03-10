import { describe, expect, it, spyOn } from "bun:test";
import { findReferencedClasses, transformCSS, transformRunes } from "../lib/walk.ts";
import { parse } from "svelte/compiler";
import { baseStyles, source, used } from "./dummy.ts";
import MagicString from "magic-string";

describe("findReferencedClasses", () => {

	const run = (source: string) => {
		const ast = parse(source, { filename: "test.svelte", modern: true });
		return findReferencedClasses(ast);
	}

	it("should find all classes referenced by runes", () => {
		const {classes} = run(source);
		expect(classes.size).toBe(3);
		expect(classes.has("test")).toBe(true);
		expect(classes.has("test2")).toBe(true);
		expect(classes.has("test3")).toBe(true);
	});

	it("should find all classes used natively on class attributes as string", () => {
		const {usedClasses} = run(used);
		expect(usedClasses.has("test")).toBe(true);
	});

	it("should find all classes used natively on class attributes as array", () => {
		const {usedClasses} = run(used);
		expect(usedClasses.has("test4")).toBe(true);
	});


	it("should find all classes used natively on style bindings as object", () => {
		const {usedClasses} = run(used);
		expect(usedClasses.has("test8")).toBe(true);
		expect(usedClasses.has("test9")).toBe(true);
	});

	it("not mistake unused classes as used", () => {
		const {usedClasses} = run(used);
		expect(usedClasses.has("test2")).toBe(false);
		expect(usedClasses.has("test3")).toBe(false);
	});

	it("finds classes used by runes and natively", () => {
		const {usedClasses, classes} = run(used);
		expect(classes.has("test")).toBe(true);
		expect(usedClasses.has("test")).toBe(true);
	});

	it("should detect multiple classes in a single rune", () => {
		const {usedClasses, classes} = run(`<script> const t = $css("a b")</script><span class={$css("b c")}>test</span><span class="c d">test</span>`);

		expect(usedClasses.has("c")).toBe(true);
		expect(usedClasses.has("d")).toBe(true);
		expect(usedClasses.has("a")).toBe(false);
		expect(usedClasses.has("b")).toBe(false);

		expect(classes.has("a")).toBe(true);
		expect(classes.has("b")).toBe(true);
		expect(classes.has("c")).toBe(true);
		expect(classes.has("d")).toBe(false);

	});

	it("should throw on improper rune usage", () => {
		expect(() => run(`<script> const t = $css(3)</script>`)).toThrowError();
		expect(() => run(`<script> const t = $css("test","class")</script>`)).toThrowError();
		expect(() => run(`<script> const t = $css()</script>`)).toThrowError();
	});


});

const loc = {start: 0, end: 0};

describe("transformCSS", () => {
	const run = (content: string, overrideClasses?: Map<string, {start: number, end: number}>, overrideUsedClasses?: Map<string, {start: number, end: number}>, warn = false) => {
		const magicContent = new MagicString(content);
		const ast = parse(content, { filename: "test.svelte", modern: true });
		const h ="hash";
		const {classes, usedClasses} = findReferencedClasses(ast);
		const transformedClasses = transformCSS(ast, content, magicContent, overrideClasses ?? classes, overrideUsedClasses ?? usedClasses, h, "test.svelte", content, warn);
		return {content: magicContent.toString(), transformedClasses};
	}

	const spy = spyOn(console, "warn");

	it("should transform only used classes", () => {
		const {content} = run(baseStyles, new Map(), new Map());
		expect(content).toBe(baseStyles);
	});
	it("should transform only used classes", () => {
		const {content, transformedClasses} = run(source + baseStyles);
		expect(content).not.toInclude("unused-hash");
		expect(content).not.toInclude(":global(unused");
	});

	it("should map old styles", () => {
		const {transformedClasses} = run(source + baseStyles);
		expect(transformedClasses).toContainKeys(["test", "test2", "test3"]);
		expect(transformedClasses).not.toContainKey(["unused"]);
		const pairs = Object.entries(transformedClasses);
		expect(pairs.find(([key, value]) => value != key + "-hash")).toBeFalsy();
	});
	it("should duplicate styles if used by runes and native", () => {
		const {content} = run(used + baseStyles);
		expect(content).toMatch(/test[^-]/g);
		expect(content).toInclude(":global(.test-hash)");
	});

	it("should not warn if no rule uses multiple classes that are used by rune and natively", () => {
		expect(spy).toHaveBeenCalledTimes(0);
	});

	it("should fail on illegal mixed css selector", () => {
		const globalClasses = new Map([["global1", loc], ["global2", loc],  ["global3", loc], ["global4", loc]]);
		const exec = () => run("<style>.global1 .global2 .global3 .local .local .global4{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["test2",loc]]));
		const exec2 = () => run("<style>.global1 .global2 .global3 .local .local .global4{ color: rebeccapurple; }</style>", globalClasses, new Map([["global2", loc], ["test2",loc]]));
		const exec3 = () => run("<style>.global1 .local .global2 .local .local .global3{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["test2",loc]]));
		expect(exec).not.toThrowError();
		expect(exec2).toThrowError();
		expect(exec3).toThrowError();
	});

	it("should warn on mixed usage if mixedUseWarnings are enabled", () => {
		const warn = spyOn(console, "warn");
		const globalClasses = new Map([["global1", loc], ["global2", loc],  ["global3", loc], ["global4", loc]]);
		const exec = () => run("<style>.global1 .global2{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["local2",loc]]), true);
		const exec2 = () => run("<style>.local .local{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["local2",loc]]), true);
		const exec3 = () => run("<style>.global1 .local{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["local2",loc]]), true);
		const exec4 = () => run("<style>.global1 .local .local2  .global2{ color: rebeccapurple; }</style>", globalClasses, new Map([["local", loc], ["local2",loc]]), true);

		expect(exec).not.toThrowError();
		expect(warn).toHaveBeenCalledTimes(0);
		expect(exec2).not.toThrowError();
		expect(warn).toHaveBeenCalledTimes(0);
		expect(exec3).not.toThrowError();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(exec4).not.toThrowError();
		expect(warn).toHaveBeenCalledTimes(2);
	});
});


describe("transformRunes", () => {
	const run = (content: string, runes: string[]) => {
		const magicContent = new MagicString(content);
		transformRunes(parse(content, { filename: "test.svelte", modern: true }), magicContent, new Map(runes.map((r) => [r, {start: 0, end: 0}])), Object.fromEntries(runes.map((r) => [r, r + "-hash"])));
		return magicContent.toString();
	};


	it("should transform runes", () => {
		const content = `<script> const test = $css("test")</script>`;
		const runes = ["test"];
		expect(run(content, runes)).toInclude("test-hash");
	});

	it ("should transform multiple runes", () => {
		const content = `<script> const test = $css("test")</script><span class={$css("test")}>test</span>`;
		const runes = ["test"];
		expect(run(content, runes)).toInclude("test-hash");
	});

	it ("should throw on runes with undefined classes", () => {
		const content = `<script> const test = $css("test")</script><span class={$css("test")}>test</span>`;
		const runes = ["test2"];
		expect(() => run(content, runes)).toThrowError();
	});

	it("should transform runes with multiple classes", () => {
		const content = `<script> const test = $css("test test2")</script><span class={$css("test2")}>test</span>`;
		const runes = ["test", "test2"];
		expect(run(content, runes)).toInclude("test-hash");
		expect(run(content, runes)).toInclude("test2-hash");
	});

	it("should transform runes in markup", () => {
		const content = `<span class={$css("test")}>test</span>`;
		const runes = ["test"];
		expect(run(content, runes)).toInclude("test-hash");
	});

	it("should transform runes in markup with multiple classes", () => {
		const content = `<span class={$css("test test2")}>test</span>`;
		const runes = ["test", "test2"];
		expect(run(content, runes)).toInclude("test-hash");
		expect(run(content, runes)).toInclude("test2-hash");
	});

	it("should transform runes in modules", () => {
		const content = `<script module> const test = $css("test")</script>`;
		const runes = ["test"];
		expect(run(content, runes)).toInclude("test-hash");
	});

	it("should transform runes in modules with multiple classes", () => {
		const content = `<script module> const test = $css("test test2")</script>`;
		const runes = ["test", "test2"];
		expect(run(content, runes)).toInclude("test-hash");
		expect(run(content, runes)).toInclude("test2-hash");
	});

	it("should transform runes in modules, scripts and markup", () => {
		const content = `<script module> const test = $css("test test2")</script><script> const test = $css("test3")</script><span class={$css("test4")}>test</span>`;
		const runes = ["test", "test2", "test3", "test4"];
		expect(run(content, runes)).toInclude("test-hash");
		expect(run(content, runes)).toInclude("test2-hash");
		expect(run(content, runes)).toInclude("test3-hash");
		expect(run(content, runes)).toInclude("test4-hash");
	});
});