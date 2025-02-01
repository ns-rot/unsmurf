<script>
  import { uncanonicalizeName } from "./settingsUtils.js";

  export let canonicalizedName = "";
  export let canonicalizedMasterName = "";
  export let isCTE = false;
  export let isPuppet = false;

  // Check visibility condition
  $: isVisible = (isCTE || isPuppet) && canonicalizedName.length > 2;
  $: formattedName = uncanonicalizeName(canonicalizedName);
  $: formattedMasterName = uncanonicalizeName(canonicalizedMasterName);

  // If the nation is its own master, it is not a puppet
  $: if (canonicalizedName === canonicalizedMasterName) {
    isPuppet = false;
  }

  // Background & text color logic using hex RGBA
  $: bgColor =
    canonicalizedName.length <= 2
      ? "#00000000"
      : isCTE
      ? "#000000FF"
      : "#00000000";

  $: textColor =
    canonicalizedName.length <= 2
      ? "#00000000"
      : isCTE
      ? "#FFFFFF"
      : isPuppet
      ? "#000000"
      : "transparent";

  // Alert message logic
  $: alertMessage =
  canonicalizedName.length <= 2
    ? "　"
    : (canonicalizedName === canonicalizedMasterName) && !isCTE && !isPuppet
    ? "　"
    : isCTE && isPuppet
    ? `<strong>${formattedName}</strong>, a puppet of <strong>${formattedMasterName}</strong>, is not an active nation`
    : isCTE
    ? `<strong>${formattedName}</strong> is not an active nation`
    : `<strong>${formattedName}</strong> is a puppet of <strong>${formattedMasterName}</strong>`;
</script>

<!-- Ensures text is fully visible within 120% width -->
<div class="overflow-x-hidden">
  <div
    class="w-[120%] mx-[-10%] font-inter text-xl py-3 mt-6 mb-4 transition-all duration-200 min-h-[3rem]"
    role="alert"
    style="background-color: {bgColor}; color: {textColor}; transition: background-color 0.5s, color 0.5s;"
  >
    <div class="w-[80%] mx-auto text-center">
      {@html alertMessage}
    </div>
  </div>
</div>