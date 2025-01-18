import { parse, preprocess } from 'svelte/compiler';
import type { AST, PreprocessorGroup, MarkupPreprocessor } from 'svelte/compiler';
import { findReferencedClasses, transformCSS, transformRunes } from './walk.js';
import MagicString from 'magic-string';
import { prettyMessage } from "./error.js";


declare global {

	
	/**
	 * Declares usage of a CSS class
	 * 
	 *
	 * Example:
	 * ```ts
	 * let dark = boolean;
	 * let class = dark?$css("black"):$css("white");
	 * ```
	 * ```svelte
	 * <Child class={$css("class")} />
	 * ```
	 *
	 * @param classNames The name of the classes you want to use
	 */
	function $css<T extends string>(classNames: T): T;
}

const regex_return_characters = /\r/g;

function genHash(str: string) {
	str = str.replace(regex_return_characters, "");
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return (hash >>> 0).toString(36);
}

export type Options = {
	hash: (str: string) => string;
}

const markup: (options: Options) => MarkupPreprocessor = ({hash}) => ({ content, filename }) => {
	let ast: AST.Root;
	try {
	  ast = parse(content, { modern: true, filename });
	} catch (err) {
	  throw new Error(`${err}\n\nThe svelte component failed to be parsed.`);
	}	

	try {
		const {classes, usedClasses} = findReferencedClasses(ast);
		// skip if rune is not used
		if(classes.size === 0){
			return { code: content }
		}
		const hashed = hash(filename + content);
		const magicContent = new MagicString(content);
		const transformedClasses = transformCSS(ast, content, magicContent, classes, usedClasses, hashed, filename);
		transformRunes(ast, magicContent, classes, transformedClasses);
		const code = magicContent.toString();

		return {
			code,
			map: magicContent.generateMap({ hires: true })
		};
	} catch (err: any) {

		// pretty print the error
		err.filename = filename;

		// if the error is not from the compiler, throw it
		if(err.start === undefined || err.end === undefined){
			// this in an internal error
			// this should never happen
			// throw it to let the user know
			// this line should always be unreachable and untested
			throw err;
		}

		const e = new Error("\n\n[$css rune]: " + err.message + "\n\n");
		e.message = prettyMessage(filename, content, err);
		delete e.stack 
		throw e;
	}
};
export const processCssRune = (options: Partial<Options> = {}) => {
	const defaultOptions: Options = {
		hash: genHash
	};
	const o = {...defaultOptions, ...options};

	// allow to override hash option with undefined to use the default hash function (for testing)
	if(!o.hash){
		o.hash = genHash;
	}

	return {
		markup: markup(o)
	}
}

export default processCssRune;