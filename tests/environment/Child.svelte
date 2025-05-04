<script>
  let { class: className, buttonClass } = $props();
</script>

<div class={className} id="child-component">
  <button
    class={[buttonClass ? buttonClass : undefined, "btn"]}
    id="child-button">Click me</button
  >
</div>

<style>
  .btn {
    border: 1px solid black;
  }
</style>
