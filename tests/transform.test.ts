import processCssRune from "../lib/index.ts";
import { expect, test } from "bun:test";
import { source, baseStyles, used, child} from "./dummy.ts";
import { Processed } from "svelte/compiler";


const transform = (content) => processCssRune().markup({content, filename: "test.svelte"}) as Processed;
test("replace rune", () => {
  const result = transform(source + baseStyles);
  console.log(result.code);
});

test("duplicate style", () => {
  const result = transform(used + baseStyles);
  console.log(result.code);
})

test("assign style", () => {
  const result = transform(child);
  console.log(result.code);
});
test("bind style", () => {
  const result = transform(used);
  console.log(result.code);
})