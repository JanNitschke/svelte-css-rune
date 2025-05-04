import { parse } from "svelte/compiler";
import type { AST, MarkupPreprocessor } from "svelte/compiler";
import { findReferencedClasses, transformCSS, transformRunes } from "./walk.js";
import MagicString from "magic-string";
import { prettyMessage, printLocation, printBelow } from "./error.js";

const RUNE_CLASSES = ["__css_rune", "__css_rune_specific"];
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
  mixedUseWarnings: false | "use" | true;
  increaseSpecificity: boolean;
};

const markup: (options: Options) => MarkupPreprocessor =
  ({ hash, mixedUseWarnings, increaseSpecificity }) =>
  ({ content, filename }) => {
    let ast: AST.Root;
    try {
      ast = parse(content, { modern: true, filename });
    } catch (err) {
      throw new Error(`${err}\n\nThe svelte component failed to be parsed.`);
    }
    const runeClasses = increaseSpecificity ? RUNE_CLASSES : [];
    try {
      const { classes, usedClasses } = findReferencedClasses(ast);
      // skip if rune is not used
      if (classes.size === 0) {
        return { code: content };
      }
      const hashed = hash(filename + content);
      const magicContent = new MagicString(content);
      if (mixedUseWarnings) {
        classes.forEach(({ start, end }, className) => {
          const used = usedClasses.get(className);
          if (used) {
            let warning = `[css rune]: The class "${className}" is used directly and with the $css rune. Consider using the $css rune for all classes.`;
            const runeLoc = printLocation(filename, content, start, end, 3);
            const usedLoc = printLocation("", content, used.start, used.end, 3);
            warning += "\n\n" + runeLoc.text;
            warning += printBelow("used with $css rune", runeLoc.startColumn);
            warning += "\n" + usedLoc.text;
            warning += printBelow(
              "used without $css rune",
              usedLoc.startColumn
            );
            warning += "\n\n";
            warning +=
              "You can suppress this warning by setting the `mixedUseWarnings` option to `false`.\n";
            warning +=
              "More Information: https://github.com/JanNitschke/svelte-css-rune#edge-cases \n";
            warning += "\n";
            console.warn(warning);
          }
        });
      }

      const transformedClasses = transformCSS(
        ast,
        content,
        magicContent,
        classes,
        usedClasses,
        hashed,
        filename,
        content,
        mixedUseWarnings === true,
        runeClasses
      );
      transformRunes(
        ast,
        magicContent,
        classes,
        transformedClasses,
        runeClasses
      );
      const code = magicContent.toString();

      return {
        code,
        map: magicContent.generateMap({ hires: true }),
      };
    } catch (err: any) {
      // pretty print the error
      err.filename = filename;

      // if the error is not from the compiler, throw it
      if (err.start === undefined || err.end === undefined) {
        // this in an internal error
        // this should never happen
        // throw it to let the user know
        // this line should always be unreachable and untested
        throw err;
      }

      const e = new Error("\n\n[$css rune]: " + err.message + "\n\n");
      e.message = prettyMessage(filename, content, err);
      delete e.stack;
      throw e;
    }
  };
export const processCssRune = (options: Partial<Options> = {}) => {
  const defaultOptions: Options = {
    hash: genHash,
    mixedUseWarnings: "use",
    increaseSpecificity: false,
  };
  const o = { ...defaultOptions, ...options };

  // allow to override hash option with undefined to use the default hash function (for testing)
  if (!o.hash) {
    o.hash = genHash;
  }

  return {
    markup: markup(o),
  };
};

export default processCssRune;
