import { parse, preprocess } from 'svelte/compiler';
import type { AST, PreprocessorGroup, MarkupPreprocessor } from 'svelte/compiler';
import { findReferencedClasses, transformCSS, transformRunes } from './walk.js';
import MagicString from 'magic-string';


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
		const e = new Error("\n\n[$css rune]: " + err.message + "\n\n");

		// if the error is not from the compiler, throw it
		if(err.start === undefined){
			e.stack = err.stack;
			if(err.detail){
				e.message += err.detail;
			}
			throw e;
		}

		// if the error is from the compiler, pretty print it
		e.message += filename + "\n\n";
		const preError = content.substring(0, err.start);
		const length = (err.end ?? err.start + 1) - err.start;
		const preLines = preError.split("\n"); 
		preLines.pop(); // get the lines before the error

		const startLine = preLines.length; 
		const lines = content.split("\n");
		const line = lines[startLine].replaceAll("\t", " ");
		// get the index of the start of the line.
		const lineStart = preLines.reduce((acc, val) => acc + val.length, 0) + preLines.length; // add back the new line characters
		const startColumn = err.start - lineStart;
		const lineCountLength = startLine.toString().length;

		// print the lines before the error
		if(startLine > 1){
			e.message += (startLine - 2).toString().padStart(lineCountLength, " ");
			e.message += "|";
			e.message += lines[startLine - 2].replaceAll("\t", " ");
			e.message += "\n";
		}
		if(startLine > 0){
			e.message += (startLine - 1).toString().padStart(lineCountLength, " ");
			e.message += "|";
			e.message += lines[startLine - 1].replaceAll("\t", " ");
			e.message += "\n";
		}
		// print the line with the error
		e.message += startLine.toString();
		e.message += "|";
		e.message += line;
		e.message += "\n";
		// mark the error range
		e.message += " ".repeat(Math.max(startColumn, 0) + lineCountLength + 1);
		e.message += "^".repeat(length);
		e.message += "\n";
		// print error details centered in the error range
		if(err.detail){
			e.message += " ".repeat(Math.floor(Math.max(startColumn +  lineCountLength + 1 +(length / 2) - (err.detail.length / 2), 0)));
			e.message += err.detail;
		}

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



/**
 * Create a group of preprocessors which will be processed in a linear order
 * Taken from: https://github.com/micantoine/svelte-preprocess-cssmodules
 * Tank you Antoine Michael
 * @param preprocessors list of preprocessors
 * @returns group of `markup` preprocessors
 */
export const linearPreprocessor = (preprocessors: PreprocessorGroup[]): PreprocessorGroup[] => {
	return preprocessors.map((p) => {
	  return !p.script && !p.style
		? p
		: {
			async markup({ content, filename }) {
			  return preprocess(content, p, { filename });
			},
		  };
	});
};
  