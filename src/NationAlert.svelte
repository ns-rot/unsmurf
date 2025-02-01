<script>
  import { uncanonicalizeName } from "./settingsUtils.js";

  export let canonicalizedName = "";
  export let canonicalizedMasterName = "";
  export let isCTE = false;
  export let isPuppet = false;

  // Check visibility condition
  $: isVisible = (isCTE || isPuppet) && canonicalizedName.length > 2;
  $: formattedName = isCTE ? "&#xe000;&#x2009;" + uncanonicalizeName(canonicalizedName) : uncanonicalizeName(canonicalizedName);
  $: formattedMasterName = isCTE ? "&#xe000;&#x2009;" + uncanonicalizeName(canonicalizedMasterName) : uncanonicalizeName(canonicalizedMasterName);

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

  <div
    class="mx-[-0.375rem] sm:mx-[-1rem] md:mx-[-1.5rem] lg:mx-[-2rem] xl:mx-[-6%] font-inter text-xl py-4 mt-4 mb-2 transition-all duration-200 min-h-[3rem]"
    role="alert"
    style="background-color: {bgColor}; color: {textColor}; transition: background-color 0.5s, color 0.5s;"
  >
    <div class="w-[80%] mx-auto text-center">
      {@html alertMessage}
    </div>
  </div>
