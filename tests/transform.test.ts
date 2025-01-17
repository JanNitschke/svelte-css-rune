import processCssRune from "../lib/index.ts";
import { describe, expect, it } from "bun:test";
import { hash, source, baseStyles, used, child, sourceTransformed, baseStylesTransformed, usedTransformed, baseStylesTransformedUsed, childTransformed} from "./dummy.ts";
import { Processed } from "svelte/compiler";

const transform = (content) => processCssRune({hash}).markup({content, filename: "test.svelte"}) as Processed;

describe("rune replacement", () => {
  it("should replace runes", () => {
    const result = transform(source + baseStyles);
    expect(result.code).toStartWith(sourceTransformed);
  });

  it("should assign style to components", () => {
    const result = transform(child + baseStyles);
    expect(result.code).toStartWith(childTransformed);
  });

  it("should transform referenced style", () => {
    const result = transform(source + baseStyles);
    expect(result.code).toEndWith(baseStylesTransformed);
  });
  
  it("should duplicate style if used by runes and native", () => {
    const result = transform(used + baseStyles);
    expect(result.code).toEndWith(baseStylesTransformedUsed);
  });
  
  it("should append a unique hash to the classnames, based on content and file path", () => {
    const content1 = `<script> const test = $css("test")</script><span class={$css("test")}>test</span><style>.test{}</style>`;
    const content2 = `<script> const test = $css("test")</script><span class={$css("test")}>test2</span><style>.test{}</style>`;
    const transformed1 =  processCssRune().markup({content: content1, filename: "test.svelte"}) as Processed;
    const transformed2 =  processCssRune().markup({content: content2, filename: "test.svelte"}) as Processed;
    const transformed3 =  processCssRune().markup({content: content1, filename: "test2.svelte"}) as Processed;
    const extractHash  = (content: string) => content.match(/:global\(\.test\-(\w+)\)/)?.[1];
    expect(extractHash(transformed1.code)).not.toEqual(extractHash(transformed2.code));
    expect(extractHash(transformed1.code)).not.toEqual(extractHash(transformed3.code));
    expect(extractHash(transformed2.code)).not.toEqual(extractHash(transformed3.code));

  });

});