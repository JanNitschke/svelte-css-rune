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
	 * let class = dark?$css(black):$css(white);
	 * ```
	 * ```svelte
	 * <Child class={$css("class")} />
	 * ```
	 *
	 * @param initial The initial value
	 */
	function $css<T>(initial: T): T;
}

const markup: () => MarkupPreprocessor = () => ({ content, filename }) => {
	let ast: AST.Root;
	try {
	  ast = parse(content, { modern: true, filename });
	} catch (err) {
	  throw new Error(`${err}\n\nThe svelte component failed to be parsed.`);
	}	

	try {
		const magicContent = new MagicString(content);
		const {classes, usedClasses} = findReferencedClasses(ast);
		const transformedClasses = transformCSS(ast, content, magicContent, classes, usedClasses);
		transformRunes(ast, magicContent, classes, transformedClasses);
		const code = magicContent.toString();

		return {
			code,
			map: magicContent.generateMap({ hires: true })
		};

	} catch (err: any) {
		err.filename = filename;
		const e = new Error("\n\n[$css rune]: " + err.message + "\n\n");
		if(err.start === undefined){
			e.stack = err.stack;
			if(err.detail){
				e.message += err.detail;
			}
			throw e;
		}
		e.message += filename + "\n\n";
		const preError = content.substring(0, err.start);
		const length = (err.end ?? err.start + 1) - err.start;
		const preLines = preError.split("\n");
		preLines.pop();
		const startLine = preLines.length; 
		const lines = content.split("\n");
		const line = lines[startLine].replaceAll("\t", " ");
		const lineStart = preLines.reduce((acc, val) => acc + val.length, 0) + preLines.length;
		const startColumn = err.start - lineStart;
		const lineCountLength = startLine.toString().length;

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
		e.message += startLine.toString();
		e.message += "|";
		e.message += line;
		e.message += "\n";
		e.message += " ".repeat(Math.max(startColumn, 0) + lineCountLength + 1);
		e.message += "^".repeat(length);
		e.message += "\n";
		if(err.detail){
			e.message += " ".repeat(Math.floor(Math.max(startColumn +  lineCountLength + 1 +(length / 2) - (err.detail.length / 2), 0)));
			e.message += err.detail;
		}

		delete e.stack 
		throw e;
	}
};
export const processCssRune = () => {
	return {
		markup: markup()
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
  