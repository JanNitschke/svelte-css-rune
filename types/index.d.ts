
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
	 * @param classNames The names value
	 */
	function $css<T>(classNames: T): T;
}
export {};