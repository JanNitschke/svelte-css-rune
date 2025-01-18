import { walk, type Visitor } from "zimmerframe";
import type { AST } from "svelte/compiler";
import MagicString from "magic-string";

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
	const usedClasses = new Set<string>();
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
				usedClasses.add(node.name);
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
						values.forEach((val) => usedClasses.add(val));
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
							usedClasses.add(key.value?.toString() || "");
						}
						if (key.type === "Identifier") {
							usedClasses.add(key.name);
						}
					}
				});
				next({ inClass: false });
			},
			Literal: (node, { next, state }) => {
				if (state.inClass) {
					const values = processClasses((node as any).value);
					values.forEach((val) => usedClasses.add(val));
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


type SelectorInfo = {
	start: number
	end: number,
	original: string,
	transformed: string
}

/**
 * Create all possible permutations of the selectors
 * 
 * Unfortunately the svelte compiler does only allow global selectors at the beginning or end of a selector list.
 * This function is capable of creating all possible permutations should this limitation be removed in the future.
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
	permutations.forEach((permutation) => {
		const magicRule = new MagicString(content);
		selectors.forEach((selector, index) => {
			if (permutation[index]) {
				magicRule.overwrite(selector.start, selector.end, selector.transformed);
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
const validateClassPlacement = (otherSelectors: AST.BaseNode[], runeClasses:  SvelteFragments["ClassSelector"][], nativeClasses: Set<string>, start: number, end: number) => {
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
 * @returns
 */
export const transformCSS = (
	ast: AST.Root,
	source: string,
	magicContent: MagicString,
	globalClasses: Map<string, { start: number; end: number }>,
	usedClasses: Set<string>, 
	hash: string,
	fileName?: string|undefined
):  Record<string, string> => {
	const allClasses = new Set<string>();
	const transformedClasses: Record<string, string> = {};
	if (!ast.css) {
		return transformedClasses;
	}

	let ruleChangedClasses: SvelteFragments["ClassSelector"][] = [];
	let ruleUnchangedSelectors: AST.BaseNode[] = [];

	walk<AST.CSS.Node, { inRune?: boolean; inRule?: boolean }>(
		ast.css,
		{},
		{
			_: (node, { next, state }) => {
				next(state);
			},
			Rule: (node, { next, state }) => {
				ruleChangedClasses = [];
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
							transformed: `:global(.${transformedClasses[val.name]})`
						}));
						const permutations = createPermutations(selectorString, classMap);
						magicContent.overwrite(selectors.start, selectors.end, permutations);
					}else{
						ruleChangedClasses.forEach((val) => {
							const transformed = transformedClasses[val.name];
							magicContent.overwrite(val.start, val.end, `:global(.${transformed})`);
						});
					}
				}
				// reset classes
				ruleChangedClasses = [];
			},
			ClassSelector: (node, { next, state }) => {
				const name = node.name;
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
