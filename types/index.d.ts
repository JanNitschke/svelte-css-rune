
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
export {};