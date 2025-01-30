<script>
    export let formattedName;
    export let formattedMasterName;
    export let isCTE;
    export let isPuppet;
  
    let alertMessage = '';
  
    if (isCTE && isPuppet) {
      alertMessage = `<strong>${formattedName}</strong>, a puppet of <strong>${formattedMasterName}</strong>, is not an active nation.`;
    } else if (isCTE) {
      alertMessage = `<strong>${formattedName}</strong> is not an active nation.`;
    } else if (isPuppet) {
      alertMessage = `<strong>${formattedName}</strong> is a puppet of <strong>${formattedMasterName}</strong>.`;
    }
  </script>
  
  {#if isCTE || isPuppet}
    <div class="w-[120%] mx-[-10%] bg-black text-white text-center font-inter py-3 mt-7.5 mb-4.5" role="alert">
      <div class="w-[75%] mx-auto" innerHTML={alertMessage}></div>
    </div>
  {/if}