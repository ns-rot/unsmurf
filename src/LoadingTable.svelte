<script>
  export let title = '';
  export let content = '';

</script>

<!-- Optional Title -->
{#if title}
  <h2 class="text-xl font-semibold font-inter mt-2 mb-2">
    {title}
  </h2>
  <p>{content}</p>
{/if}
