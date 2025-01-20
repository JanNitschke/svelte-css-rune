import processCssRune from "../lib/index.ts";
import { describe, expect, it } from "bun:test";
import { baseStyles} from "./dummy.ts";
import { Processed } from "svelte/compiler";
import { toDOM, toCSSOnly } from "./e2e.test.ts";

const hash = () => "hash";

const transform = (content, warn = false) => processCssRune({hash, mixedUseWarnings: warn}).markup({content, filename: "test.svelte"}) as Processed;

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
  it("should allow chaining of global classes", () => {
    const { document, getStyle } = toDOM(`
      <span class={$css("test container")}>test</span>
      <style>.container.test{ color: rebeccapurple } .container .test{ color: red }</style>
      `);
      const span = document.querySelector("span");
      expect(getStyle(span)?.color).toEqual("rebeccapurple");
  });
  
  it("should allow chaining of global and local classes", () => {
    const { document, getStyle } = toDOM(`
      <script> const t = ''; </script>
      <div class="mixed">test</div>
      <span class="{$css("container test")} local {$css("mixed")}">test</span>
      <style>.container.test.local.mixed{ color: rebeccapurple } .container .test{ color: red }</style>
      `);
      const span = document.querySelector("span");
      expect(getStyle(span)?.color).toEqual("rebeccapurple");
  });

  it("should fail on illegal mixed css selector", () => {
    const exec = () => toDOM(`
      <div class="container">
        <p class={$css("test")}>
          <span class={$css("inner")}>text</span>
        </p>
        <span class="test">test</span>
      </div>
      <div class={$css("container")}>
        <p class="inner">inner</p>
      </div>
      <style>.container .test{ color: rebeccapurple; } .container .test .inner{ color: red; }</style>
      `);

      const exec2 = () => toDOM(`
        <div class="local" />
          <div class={$css("global1")} />
           <div class={$css("global2")} />
            <div class={$css("global3")} />
             <div class={$css("global4")} />

        <style>.global1 .global2 .global3 .local .local .global4{ color: rebeccapurple; }</style>
        `);

      const exec3 = () => toDOM(`
        <div class="local">
          <p class={$css("global")}>
          </p>
        </div>
        <style>.global .local .global .local .local .global{ color: rebeccapurple; }</style>
        `);

      expect(exec).toThrow("Invalid class placement. Svelte only allows global classes at the beginning or end of a selector list.");
      expect(exec2).not.toThrow();
      expect(exec3).toThrow("Invalid class placement. Svelte only allows global classes at the beginning or end of a selector list.");

  });

  it("should detect incorrect usage with non class selectors", () => {
    const exec = () => toDOM(`
      <div data-container />
      <div class={$css("container")} />
      <div id="container" />

      <style> div[data-container] .container #container { color: rebeccapurple; } </style>
      `);

      expect(exec).toThrow("Invalid class placement. Svelte only allows global classes at the beginning or end of a selector list.");
  });

  it("should fail on invalid components", () => {
    const exec = () => transform(`
      <<div />
      `);
      expect(exec).toThrow();
  });
});