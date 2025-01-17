import { walk, type Visitor } from 'zimmerframe';
import type { AST } from 'svelte/compiler';
import MagicString from 'magic-string';
import crypto from "node:crypto"

const RUNE_NAME = "$css";
const HASH_LENGTH = 2;

type NodeOf<T extends string, X> = X extends { type: T } ? X : never;
type FragmentTypes<T extends AST.SvelteNode> = {
	[K in T['type']]: NodeOf<K, T>;
};
type SvelteFragments = FragmentTypes<AST.SvelteNode>;

const processClasses = (classNames: string) => {
	const classes: string[] = classNames.split(' ');
	return classes;
};
const buildError = (node: any, message: string, detail: string) => {
	const err = new Error(message);
	(err as any).start = node.start;
	(err as any).end = node.end;
	(err as any).detail = `${detail}`;
	return err;
}

const runeVisitor = <T>(visitor: (node: SvelteFragments["CallExpression"], value: string, state: T) => T): Visitor<SvelteFragments["CallExpression"], T, AST.SvelteNode> => (node, ctx) => {
	if(node.callee.type === "Identifier" && node.callee.name === RUNE_NAME){
		if (node.arguments.length !== 1 || node.arguments[0].type !== 'Literal') {
			throw buildError(node, 'Invalid $css call', '$css must have exactly one argument');
		}
		const literal = node.arguments[0] as SvelteFragments["Literal"];
		if(typeof literal!.value == "string"){
			const res = visitor(node, literal!.value, ctx.state);
			ctx.next(res);
			return;
		}else{
			throw buildError(node, 'Invalid $css call', '$css argument must be a string');
		}
	}
	ctx.next(ctx.state);
}


export const findReferencedClasses = (ast: AST.Root) => {
	const classes = new Map<string, {start: number, end: number}>();
	const usedClasses = new Set<string>();
	const addClass = <T>(node: SvelteFragments["CallExpression"], value: string, state: {inClass?: boolean}) => {
		const values = processClasses(value);
		values.forEach((val) => classes.set(val, {start: (node as any).start, end: (node as any).end})); 
		return {inClass: false};
	}
	walk<AST.SvelteNode, {inClass?: boolean}>(ast.fragment, {}, {
		_: (node, {next, state}) => {
			next(state);
		},
		CallExpression: runeVisitor(addClass),
		ClassDirective: (node, {next, state}) => {
			usedClasses.add(node.name);
			next(state);
		},
		Attribute: (node, {next, state}) => {
			if(node.name === "class"){
				if(Array.isArray(node.value) && node.value.length === 1 && node.value[0].type === "Text"){
					const values = processClasses(node.value[0].data);
					values.forEach((val) => usedClasses.add(val));
					next({inClass: false});
				}else{
					next({inClass: true});
				}
			}else{
				next(state);
			}
		},
		ObjectExpression: (node, {next, state}) => {
			node.properties.forEach((prop) => {
				if(prop.type === "Property"){
					const key = prop.key;
					if(key.type === "Literal"){
						usedClasses.add(key.value?.toString() || "");
					}
					if(key.type === "Identifier"){
						usedClasses.add(key.name);
					}
				}
			})
			next({inClass: false});
		},
		Literal: (node, {next, state}) => {
			if(state.inClass){
				const values = processClasses((node as any).value);
				values.forEach((val) => usedClasses.add(val));
			}
			next(state);
		},
	});
	if(ast.instance){
		walk<AST.SvelteNode, {inClass?: boolean}>(ast.instance as any, {}, {
			_: (node, {next}) => {
				next({});
			},
			CallExpression: runeVisitor(addClass)
		});
	}
	if(ast.module){
		walk<AST.SvelteNode, {inClass?: boolean}>(ast.module as any, {}, {
			_: (node, {next}) => {
				next({});
			},
			CallExpression: runeVisitor(addClass)
		});
	}
	return {classes, usedClasses};
}
const md5 = (data: string) => crypto.createHash('sha256',{ outputLength: HASH_LENGTH }).update(data).digest('base64url').toString().substring(0, 8);
const regex_return_characters = /\r/g;

function genHash(str: string) {
	str = str.replace(regex_return_characters, '');
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return (hash >>> 0).toString(36);
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
 * @returns 
 */

export const transformCSS = (ast: AST.Root, source: string, magicContent: MagicString, globalClasses: Map<string, {start: number, end: number}>, usedClasses: Set<string>) => {

	const classNames: Record<string, string> = {};
	if(!ast.css){
		return {};
	}
	const content = source.substring(ast.css.start, ast.css.end);
	const hash = genHash(content);

	let ruleClasses: string[] = [];

	walk<AST.CSS.Node, {inRune?: boolean, inRule?: boolean}>(ast.css, {}, {
		_: (node, {next, state}) => {
			next(state);
		}, 
		Rule: (node, {next, state}) => {
			ruleClasses = [];
			const transformed = next(state);
			if(transformed){
				if(ruleClasses.length > 0 && ruleClasses.some((val) => usedClasses.has(val))){
					magicContent.appendLeft(node.end, `\n${source.substring(node.start, node.end)}`);
				}
			}
		},
		ClassSelector: (node, {next, state}) => {
			const name = node.name;
			if(globalClasses.has(name)){
				const start = node.start;
				const end = node.end;
				ruleClasses.push(name);
				const transformed = `${name}-${hash}`;
				classNames[name] = transformed;
				magicContent.overwrite(start, end, `:global(.${transformed})`);
				next(state);
				return { ...node, name: transformed };
			}
			next(state);
		}
	}); 
	return classNames;
}


export const transformRunes = (ast: AST.Root, magicContent: MagicString, classes: Map<string, {start: number, end: number}>, classNames: Record<string, string>) => {

	const replaceClass = <T>(node: SvelteFragments["CallExpression"], value: string, state: T) => {
		const values = processClasses(value);
		const transformed = values.map((val) => {
			if(classNames[val]){
				return classNames[val];
			}else{
				const call = classes.get(val);
				throw buildError({start: call?.start, end: call?.end}, 'Invalid $css call', `class ${val} is not defined`);
			}
			return val;
		});
		const transformedValue = transformed.join(' ');
		const positions = node as unknown as AST.BaseNode;
		magicContent.overwrite(positions.start, positions.end, `"${transformedValue}"`);
		return state;
	}
	walk<AST.SvelteNode, {rune?: string|null}>(ast.fragment, {}, {
		_: (node, {next}) => {
			next({});
		},
		CallExpression: runeVisitor(replaceClass)
	});
	if(ast.instance){
		walk<AST.SvelteNode, {rune?: string|null}>(ast.instance as any, {}, {
			_: (node, {next}) => {
				next({});
			},
			CallExpression: runeVisitor(replaceClass)
		});
	}
	if(ast.module){
		walk<AST.SvelteNode, {rune?: string|null}>(ast.module as any, {}, {
			_: (node, {next}) => {
				next({});
			},
			CallExpression: runeVisitor(replaceClass)
		});
	}
	
}