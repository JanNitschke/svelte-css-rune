import processCssRune from "../lib/index.ts";
import { describe, expect, it } from "bun:test";
import { hash,  baseStyles} from "./dummy.ts";
import { Processed } from "svelte/compiler";
import { toDOM, toCSSOnly } from "./e2e.test.ts";

const transform = (content) => processCssRune({hash}).markup({content, filename: "test.svelte"}) as Processed;

describe("preprocessor", () => {

  it("should return the same code if no runes are used", () => {
    const result = transform(baseStyles);
    expect(result.code).toEqual(baseStyles);
  });

  it("should make classes that are referenced by a rune global", () => {
    const { document, getStyle } = toDOM(`
      <span class={$css("test")}>test</span>
      <style>.test{ color: rebeccapurple }</style>`, {hash: () => "hash"});
      const testSpan = document.createElement("span");
      testSpan.className = "test-hash";
      document.body.appendChild(testSpan);
      const style = getStyle(testSpan);
      expect(style?.color).toEqual("rebeccapurple");
  });

  it("should allow passing classes to child components", () => {
    const { document, getStyle } = toDOM(`
      <script> const { Child } = env; </script>
      <Child class={$css("test")} buttonClass={$css("test2")} />
      <style>
      .test{ color: rebeccapurple }
      .test2{ color: red }
      </style>`, {env: ["Child.svelte"]});
      const child = document.querySelector("#child-component");
      const childButton = document.querySelector("#child-button");
      expect(getStyle(child)?.color).toEqual("rebeccapurple");
      expect(getStyle(childButton)?.color).toEqual("red");
  });

  it("should avoid style collisions", () => {
    const { document, getStyle } = toDOM(`
      <script> const { Styled } = env; </script>
      <Styled />
      <span class={$css("test")}>test</span>
      <style>
      .test{ color: rebeccapurple }
      </style>`, {env: ["Styled.svelte"]});
      const styled = document.querySelector("#styled");
      const span = document.querySelector("span");
      expect(getStyle(styled)?.color).toEqual("red");
      expect(getStyle(span)?.color).toEqual("rebeccapurple");
  });



  it("should allow passing classes to javascript", () => {
    let received: any = null;
    const receive = (value) => {
      received = value;
    }
    const { document, getStyle } = toDOM(`
      <script>send($css("test")) </script>
      <style>
      .test{ color: rebeccapurple }
      </style>`, {}, receive);
      expect(received).toBeTruthy();
      expect(received).not.toEqual("test");
      expect(received).toStartWith("test");
  });

  it("should allow passing classes to javascript modules", () => {
    let received: any = null;
    const receive = (value) => {
      received = value;
    }
    toDOM(`
      <script module>send($css("test")) </script>
      <style>
      .test{ color: rebeccapurple }
      </style>`, {}, receive);
      expect(received).toBeTruthy();
      expect(received).not.toEqual("test");
      expect(received).toStartWith("test");
  });


  it("should allow mixing of global and local class usage", () => {
    const { document, getStyle } = toDOM(`
      <span class={$css("test")}>test</span>
      <span class="test">test</span>
      <style>.test{ color: rebeccapurple }</style>
      `);
      const spans = document.querySelectorAll("span");
      expect(getStyle(spans[0])?.color).toEqual("rebeccapurple");
      expect(getStyle(spans[1])?.color).toEqual("rebeccapurple");
  });

  it("should allow mixing of global and local class usage with complex selectors", () => {
    const { document, getStyle } = toDOM(`
      <div class="container">
        <span class={$css("test")}>test</span>
        <span class="test">test</span>
      </div>
      <style>.container .test{ color: rebeccapurple }</style>
      `);
      const spans = document.querySelectorAll("span");
      expect(getStyle(spans[0])?.color).toEqual("rebeccapurple");
      expect(getStyle(spans[1])?.color).toEqual("rebeccapurple");
  });

});