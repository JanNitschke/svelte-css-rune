import type MagicString from "magic-string";
import type { AST } from "svelte/compiler";

export type ProcessorState = {
	ast: AST.Root;
  	filename: string;
	magicContent: MagicString;
};