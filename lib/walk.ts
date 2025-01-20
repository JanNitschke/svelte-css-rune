import { walk, type Visitor } from "zimmerframe";
import type { AST } from "svelte/compiler";
import MagicString from "magic-string";
import { printBelow, printLocation } from "./error.js";

const RUNE_NAME = "$css";

type NodeOf<T extends string, X> = X extends { type: T } ? X : never;
type FragmentTypes<T extends AST.SvelteNode> = {
	[K in T["type"]]: NodeOf<K, T>;
};
type SvelteFragments = FragmentTypes<AST.SvelteNode>;

const processClasses = (classNames: string) => {
	const classes: string[] = classNames.split(" ");
	return classes;
};
const buildError = (node: any, message: string, detail: string) => {
	const err = new Error(message);
	(err as any).start = node.start;
	(err as any).end = node.end;
	(err as any).detail = `${detail}`;
	return err;
};

/**
 * Visitor for function calls that only runs the provided visitor if the function is a $css rune
 * Validates the arguments and calls the visitor
 * @param visitor What to do with the rune
 */
const runeVisitor =
	<T>(
		visitor: (node: SvelteFragments["CallExpression"], value: string, state: T) => T
	): Visitor<SvelteFragments["CallExpression"], T, AST.SvelteNode> =>
	(node, ctx) => {
		if (node.callee.type === "Identifier" && node.callee.name === RUNE_NAME) {
			if (node.arguments.length !== 1 || node.arguments[0].type !== "Literal") {
				throw buildError(node, "Invalid $css call", "$css must have exactly one argument");
			}
			const literal = node.arguments[0] as SvelteFragments["Literal"];
			if (typeof literal!.value == "string") {
				const res = visitor(node, literal!.value, ctx.state);
				ctx.next(res);
				return;
			} else {
				throw buildError(node, "Invalid $css call", "$css argument must be a string");
			}
		}
		ctx.next(ctx.state);
	};

/**
 * Find which classes are used in the svelte file
 * Split into classes that are used with the $css rune and classes that are used natively
 * @returns {classes, usedClasses} classes: used with rune, usedClasses: used without rune
 */

export const findReferencedClasses = (ast: AST.Root) => {
	const classes = new Map<string, { start: number; end: number }>();
	const usedClasses = new Map<string, { start: number; end: number }>();
	const addClass = <T>(
		node: SvelteFragments["CallExpression"],
		value: string,
		state: { inClass?: boolean }
	) => {
		const values = processClasses(value);
		values.forEach((val) =>
			classes.set(val, { start: (node as any).start, end: (node as any).end })
		);
		return { inClass: false };
	};
	walk<AST.SvelteNode, { inClass?: boolean }>(
		ast.fragment,
		{},
		{
			_: (node, { next, state }) => {
				next(state);
			},
			CallExpression: runeVisitor(addClass),
			ClassDirective: (node, { next, state }) => {
				usedClasses.set(node.name, { start: node.start, end: node.end });
				next(state);
			},
			Attribute: (node, { next, state }) => {
				if (node.name === "class") {
					if (
						Array.isArray(node.value) &&
						node.value.length === 1 &&
						node.value[0].type === "Text"
					) {
						const values = processClasses(node.value[0].data);
						values.forEach((val) => usedClasses.set(val, { start: node.start, end: node.end }));
						next({ inClass: false });
					} else {
						next({ inClass: true });
					}
				} else {
					next(state);
				}
			},
			ObjectExpression: (node, { next, state }) => {
				node.properties.forEach((prop) => {
					if (prop.type === "Property") {
						const key = prop.key;
						if (key.type === "Literal") {
							usedClasses.set(key.value?.toString() || "", { start: (node as any).start, end: (node as any).end });
						}
						if (key.type === "Identifier") {
							usedClasses.set(key.name, { start: (node as any).start, end: (node as any).end });
						}
					}
				});
				next({ inClass: false });
			},
			Literal: (node, { next, state }) => {
				if (state.inClass) {
					const values = processClasses((node as any).value);
					values.forEach((val) => usedClasses.set(val, { start: (node as any).start, end: (node as any).end }));
				}
				next(state);
			},
		}
	);
	if (ast.instance) {
		walk<AST.SvelteNode, { inClass?: boolean }>(
			ast.instance as any,
			{},
			{
				_: (node, { next }) => {
					next({});
				},
				CallExpression: runeVisitor(addClass),
			}
		);
	}
	if (ast.module) {
		walk<AST.SvelteNode, { inClass?: boolean }>(
			ast.module as any,
			{},
			{
				_: (node, { next }) => {
					next({});
				},
				CallExpression: runeVisitor(addClass),
			}
		);
	}
	return { classes, usedClasses };
};



/**
 * Group following global selectors that are chained like .class1.class2
 */
const groupChained = <T extends {chain?: number, start: number, end: number}>(selectors: T[]):T[][] => {
	const groups: T[][] = [];
	let current: T[] = [];
	let currentChain = 0;
	
	selectors.forEach((selector) => {
		if((selector as any).chain === undefined){
			groups.push([selector]);
			return;
		}
		if((selector as any).chain === currentChain){
			current.push(selector);
		}else{
			current = [selector];
			groups.push(current);
			currentChain = (selector as any).chain;
		}
	});
	return groups;
}

type SelectorInfo = {
	start: number
	end: number,
	original: string,
	transformed: string,
	chain?: number
}

/**
 * Group following global selectors that are chained like .class1.class2
 * Expects a list that indicates if the a selector will be transformed
 */
const groupPermutations = (selectors: SelectorInfo[], permutations: boolean[]) => {
	const groups: SelectorInfo[][] = [];
	let current: SelectorInfo[] = [];
	let currentChain = 0; 
	// keep track of the last character we have seen, to split on selectors we don't transform
	let lastChar = 0;
	selectors.forEach((selector, idx) => {
		if((selector as any).chain === undefined || !permutations[idx]){
			groups.push([selector]);
			currentChain = 0;
			lastChar = selector.end;
			return;
		}
		if(selector.chain === currentChain && selector.start == lastChar && permutations[idx]){
			current.push(selector);
		}else{
			if(permutations[idx]){
				current = [selector];
				groups.push(current);
				currentChain = (selector as any).chain;
			}else{
				groups.push([selector]);
				currentChain = 0;
			}
		} 
		lastChar = selector.end;
	});
	return groups;
}

/**
 * Create all possible permutations of the selectors
 * 
 * Unfortunately the svelte compiler does only allow global selectors at the beginning or end of a selector list.
 * This function is capable of creating all possible permutations should this limitation be removed in the future.
 * 
 * ToDo: Analyze possible selector combinations and remove unreachable groups
 * 
 * @param content selector list as string
 * @param selectors information about varying selectors
 * @returns a string containing all possible permutations of the selectors
 */
const createPermutations = (content: string, selectors: SelectorInfo[]) => {
	const count = selectors.length;
	const permutations: boolean[][] = [];
	for (let i = 0; i < 2 ** count; i++) {
		const permutation = i.toString(2).padStart(count, "0").split("").map((val) => val === "1");
		permutations.push(permutation);
	}
	const rules:string[] = [];
	// start with global selectors, so we don'r run into the the max depth of svelte dead code elimination
	permutations.reverse();
	permutations.forEach((permutation, i) => {
		const magicRule = new MagicString(content);
		const groups = groupPermutations(selectors, permutation);
		let idx = 0;
		groups.forEach((group) => {
			const transformGroup = permutation[idx];
			const groupStart = group[0].start;
			const groupEnd = group[group.length - 1].end;
			let groupVal = new MagicString(content.substring(groupStart, groupEnd));
			if(transformGroup){
				group.forEach((val) => {
					if(permutation[idx] != transformGroup){
						// groups need to consist of classes that are all transformed or all not transformed
						throw new Error("Invalid permutation");
					}
					groupVal.overwrite(val.start - groupStart, val.end - groupStart, val.transformed);
					idx++;
				});
				magicRule.overwrite(groupStart, groupEnd, `:global(${groupVal.toString()})`);
			}
		});
		rules.push(magicRule.toString());
	});
	return rules.join(",");
}

type PlacedClass = {
	name: string,
	start: number,
	kind: ClassPlacement
}
type ClassPlacement = "native"|"rune"|"mixed";

/**
 * Validate that we can compile the selector to valid svelte global selectors
 * Limitation: Svelte only allows global selectors at the beginning or end of a selector list.
 * @param otherSelectors All selectors that are used by this rule and are not used by the $css rune
 * @param runeClasses All selectors that are used by the selector and the $css rune
 * @param nativeClasses All classes that are used natively
 * @param start start of the selector list, for error reporting
 * @param end end of the selector list, for error reporting
 */
const validateClassPlacement = (otherSelectors: AST.BaseNode[], runeClasses:  SvelteFragments["ClassSelector"][], nativeClasses: Map<string, { start: number; end: number }>, start: number, end: number) => {
	const error = (cause: PlacedClass) => {
		const e = new Error("Invalid class placement. Svelte only allows global classes at the beginning or end of a selector list.");
		(e as any).start = start;
		(e as any).end = end;
		(e as any).detail = `Contains a selector that is used by runes and is not in the beginning or end of the selector list. \n\n`;
		if(cause.kind === "mixed"){
			(e as any).detail += `The class "${cause.name}" is used with the $css rune and natively. It can only be used the first or last selector.\n`;
			(e as any).detail += `Consider using the $css rune for all references to this class "${cause.name}".`;
		}
		if(cause.kind === "rune"){
			(e as any).detail += `The class "${cause.name}" is used with the $css rune. Other selectors in this rule are used natively or mixed. Classes that are used with the $css rune must be in the beginning or end of the selector.`;
			(e as any).detail += `.rune .rune .native .native .rune // OK`;
			(e as any).detail += `.rune .native .rune .native .rune // NOT OK`;
		}
		(e as any).detail += `\n`;
		(e as any).detail += `For more information see: https://github.com/JanNitschke/svelte-css-rune#edge-cases`;

		throw e;
	};
	
	const selectors: PlacedClass[] = otherSelectors.map((node) => ({name: (node as any).name, start: node.start, kind: "native"}));
	runeClasses.forEach((node) => selectors.push({name: node.name, start: node.start, kind: nativeClasses.has(node.name)?"mixed":"rune"}));
	selectors.sort((a, b) => a.start - b.start);

	let isInStart = true; // has only seen global classes
	let isInEnd = false; // has seen a native class, can only be followed by global classes

	let cause: PlacedClass|null = null;

	for(let i = 0; i < selectors.length; i++){
		const selector = selectors[i];
		cause = selector.kind === "native"?cause:selector;
		// mixed can not be surrounded
		if(selector.kind === "mixed" && i !== 0 && i !== selectors.length - 1){
			error(selector);
		}
		if(selector.kind === "mixed" || selector.kind === "native"){
			if(isInStart){
				isInStart = false;
				continue;
			}
		}
		if(!isInStart && selector.kind === "rune" || selector.kind === "mixed"){
			isInEnd = true;
		}
		if(selector.kind === "native" && isInEnd){
			// we have seen a native class followed by a rune class, followed by a native class
			error(cause ?? selector);
		}
	}
};

const warnMixedUsage = (node: AST.BaseNode, filename: string|undefined, content: string, runeUsed: string[], runeNotUsed: string[]) => {
	let warning = `[css rune]: This selector uses a combination of classes that are used with runes.`;
	const selLoc = printLocation(filename, content, node.start, node.end);
	warning += "\n\n" + selLoc.text;
	warning += printBelow("combines selectors that are used with and without the $css rune", selLoc.startColumn);
	if(runeUsed.length > 1){
		warning += `\n\nThe classes ${runeUsed.join(", ")} are used with the $css rune.`;
	}else{
		warning += `\n\nThe class ${runeUsed[0]} is used with the $css rune.`;
	}
	if(runeNotUsed.length > 1){
		warning += `\nThe selectors ${runeNotUsed.join(", ")} are not used with the $css rune.`;
	}else{
		warning += `\nThe selector ${runeNotUsed[0]} is not used with the $css rune.`;
	}
	warning += 'You can suppress this warning by setting the `mixedUseWarnings` to `false` or `"use"`.\n';
	warning += "\nMore Information: https://github.com/JanNitschke/svelte-css-rune#edge-cases\n";
	console.warn(warning);
}


/**
 *
 * replace used classes with a global classname
 * duplicate the class if its used in the svelte file
 *
 * @param ast
 * @param source
 * @param magicContent
 * @param globalClasses All classes where referenced by the rune and need to bo global
 * @param usedClasses All classes that are used in the svelte file and need to available
 * @param hash A hash that is unique to the file
 * @param fileName File name for error reporting
 * @param fileContent Content of the file for error reporting
 * @param emitWarnings If warnings should be emitted
 * 
 * @returns
 */
export const transformCSS = (
	ast: AST.Root,
	source: string,
	magicContent: MagicString,
	globalClasses: Map<string, { start: number; end: number }>,
	usedClasses: Map<string, { start: number; end: number }>, 
	hash: string,
	fileName: string|undefined, 
	fileContent: string,
	emitWarnings: boolean
):  Record<string, string> => {
	const transformedClasses: Record<string, string> = {};
	if (!ast.css) {
		return transformedClasses;
	}

	let ruleChangedClasses: SvelteFragments["ClassSelector"][] = [];
	let ruleUnchangedSelectors: AST.BaseNode[] = [];
	let ruleChained = false; // detect .class1.class1 selectors to wrap them into a single global class
	let chain = 0;

	walk<AST.CSS.Node, { inRune?: boolean; inRule?: boolean }>(
		ast.css,
		{},
		{
			_: (node, { next, state }) => {
				next(state);
			},
			Rule: (node, { next, state }) => {
				ruleChangedClasses = [];
				ruleUnchangedSelectors = [];
				//walk all children to find all classes
				next(state);
				const selectors = node.prelude;

				if(ruleChangedClasses.length > 0){
					validateClassPlacement(ruleUnchangedSelectors, ruleChangedClasses, usedClasses, selectors.start, selectors.end);
					if(ruleChangedClasses.some((val) => usedClasses.has(val.name))){
					
						const start = selectors.start;
						const selectorString = source.substring(selectors.start, selectors.end);
						const classMap: SelectorInfo[] = ruleChangedClasses.map((val) => ({
							start: val.start - start,
							end: val.end - start,
							original: val.name,
							chain: (val as any).chain,
							transformed: `.${transformedClasses[val.name]}`
						}));
						const permutations = createPermutations(selectorString, classMap);
						magicContent.overwrite(selectors.start, selectors.end, permutations);
					}else{
						const groups = groupChained(ruleChangedClasses as (SvelteFragments["ClassSelector"]&{chain: undefined})[]);
						groups.forEach((group) => {
							let start = group[0].start;
							let end = group[group.length - 1].end;
							group.forEach((val) => {
								const transformed = transformedClasses[val.name];
								magicContent.overwrite(val.start, val.end, `.${transformed}`);
							});
							magicContent.appendLeft(start, ":global(");
							magicContent.appendRight(end, ")");
						});
						// ruleChangedClasses.forEach((val) => {
						// 	const transformed = transformedClasses[val.name];
						// 	magicContent.overwrite(val.start, val.end, `:global(.${transformed})`);
						// });
					}
					if(emitWarnings){
						if(ruleUnchangedSelectors.length > 0){
							warnMixedUsage(selectors, fileName, fileContent,  ruleChangedClasses.map((val) => val.name), ruleUnchangedSelectors.map((val) => (val as any).name));
						}
					}
				}
				// reset classes
				ruleChangedClasses = [];
				ruleUnchangedSelectors = [];
			},
			RelativeSelector: (node, { next, state }) => {
				if(node.selectors.length > 1){
					ruleChained = true;
					chain++;
					next(state);
					ruleChained = false;
				}else{
					next(state);
				}
			},
			ClassSelector: (node, { next, state }) => {
				const name = node.name;
				if(ruleChained){
					(node as any).chain = chain;
				}
				if (globalClasses.has(name)) {
					ruleChangedClasses.push(node);
					const transformed = `${name}-${hash}`;
					transformedClasses[name] = transformed;
				}else{
					ruleUnchangedSelectors.push(node);
				}
				next(state);
			},
			AttributeSelector: (node, { next, state }) => {
				ruleUnchangedSelectors.push(node);
				next(state);
			},
			IdSelector: (node, { next, state }) => {
				ruleUnchangedSelectors.push(node);
				next(state);
			},
			TypeSelector: (node, { next, state }) => {
				ruleUnchangedSelectors.push(node);
				next(state);
			}
		}
	);
	return transformedClasses;
};


/**
 * Replace all $css calls with the transformed classes
 * Throws an error if a rune references a class that is not defined
 * @param ast Ast of the svelte file
 * @param magicContent A magic string of the content of the whole file
 * @param classes A map of all classes that are with the rune and their position for error reporting
 * @param classNames An object that maps the original class name to the transformed class name
 */
export const transformRunes = (
	ast: AST.Root,
	magicContent: MagicString,
	classes: Map<string, { start: number; end: number }>,
	classNames: Record<string, string>
) => {
	const replaceClass = <T>(node: SvelteFragments["CallExpression"], value: string, state: T) => {
		const values = processClasses(value);
		const transformed = values.map((val) => {
			if (classNames[val]) {
				return classNames[val];
			} else {
				const call = classes.get(val);
				throw buildError(
					{ start: call?.start, end: call?.end },
					"Invalid $css call",
					`class ${val} is not defined`
				);
			}
		});
		const transformedValue = transformed.join(" ");
		const positions = node as unknown as AST.BaseNode;
		magicContent.overwrite(positions.start, positions.end, `"${transformedValue}"`);
		return state;
	};
	walk<AST.SvelteNode, { rune?: string | null }>(
		ast.fragment,
		{},
		{
			_: (node, { next }) => {
				next({});
			},
			CallExpression: runeVisitor(replaceClass),
		}
	);
	if (ast.instance) {
		walk<AST.SvelteNode, { rune?: string | null }>(
			ast.instance as any,
			{},
			{
				_: (node, { next }) => {
					next({});
				},
				CallExpression: runeVisitor(replaceClass),
			}
		);
	}
	if (ast.module) {
		walk<AST.SvelteNode, { rune?: string | null }>(
			ast.module as any,
			{},
			{
				_: (node, { next }) => {
					next({});
				},
				CallExpression: runeVisitor(replaceClass),
			}
		);
	}
};
