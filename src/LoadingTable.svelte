<script>
  import Spinner from "./Spinner.svelte";
  
  export let title = "";
  export let content = "";
</script>

  <h2 class="text-xl font-semibold font-inter mt-2 mb-2">
    {title}
  </h2>
  <p class="flex items-center space-x-2">

    <Spinner />
    <span>{content}</span>
  </p>