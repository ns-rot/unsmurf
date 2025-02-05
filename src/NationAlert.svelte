<script>
  import { canonicalizeName, uncanonicalizeName } from "./settingsUtils.js";
  import {
    isNationCurrent,
    findPuppetmaster,
    listPuppets,
    tallyPuppets,
  } from "./sheetFetch.js";

  export let nationId = "";

  // Debugging logs
  $: console.log("nationId updated in NationAlert:", nationId);

  // Compute derived values reactively
  $: canonicalizedName = canonicalizeName(nationId);
  $: canonicalizedMasterName = (() => {
    const info = findPuppetmaster(canonicalizedName).master;
    return canonicalizeName(info) === canonicalizedName ? "" : info;
  })();
  $: isCTE = !isNationCurrent(canonicalizedName);

  // Ensure a nation is NOT a puppet of itself
  $: isPuppet = canonicalizedMasterName != "" ? true : false;

  // If nation is a puppet, check if the master is a CTE
  $: isMasterCte = !isNationCurrent(canonicalizedMasterName);

  // Get puppet counts
  $: puppetCountSelf = tallyPuppets(canonicalizedName); // Puppets under the current nation
  $: puppetCountMaster = tallyPuppets(canonicalizedMasterName); // Puppets under the master nation

  // Choose which tally to display
  $: puppetTally = isPuppet ? puppetCountMaster : puppetCountSelf;

  // Format names for display
  $: formattedName = isCTE
    ? "&#xe000;&#x2009;" + uncanonicalizeName(canonicalizedName)
    : uncanonicalizeName(canonicalizedName);

  $: formattedMasterName = isMasterCte
    ? "&#xe000;&#x2009;" + uncanonicalizeName(canonicalizedMasterName)
    : uncanonicalizeName(canonicalizedMasterName);

  // Background & text color logic
  $: bgColor =
    canonicalizedName.length <= 2
      ? "#00000000"
      : isCTE
        ? "#000000FF"
        : "#00000000";

  $: textColor =
    canonicalizedName.length <= 2 ? "#00000000" : isCTE ? "#FFFFFF" : "#000000";

  // Alert message logic
  $: alertMessage = (() => {
    if (canonicalizedName.length <= 2) {
      return "　"; // Single CJK space
    }

    let returnValue = `<strong>${formattedName}</strong>`;

    if (isPuppet) {
      returnValue += ` (<strong>${formattedMasterName}</strong>)`;
    }

    return returnValue;

  })();

  $: alertMessagePuppetCount =
    puppetTally > 0 ? `<br>${puppetTally} known puppets` : "<br>No known puppets";
</script>

<!-- Alert Banner -->
<div
  class="mx-[-0.375rem] sm:mx-[-1rem] md:mx-[-1.5rem] lg:mx-[-2rem] xl:mx-[-6%] font-inter py-4 mt-4 mb-2 transition-all duration-200 min-h-[3rem]"
  role="alert"
  style="background-color: {bgColor}; color: {textColor}; transition: background-color 0.5s, color 0.5s;"
>
  <div class="w-[80%] mx-auto text-center">
    <span class="text-xl">
      {@html alertMessage}
    </span>
    <span class="text-lg">
      {@html alertMessagePuppetCount}
    </span>
  </div>
</div>
