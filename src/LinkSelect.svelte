<script>
    export let id;
    export let label;
    export let value;

    const options = [
        { value: "unsmurf", label: "Unsmurf" },
        { value: "nation", label: "NationStates" },
        { value: "trades", label: "NS Deck" },
        { value: "buys", label: "NS Card Buys" },
        { value: "sells", label: "NS Card Sales" },
        { value: "boneyard", label: "NS Boneyard" },
        { value: "custom", label: "Custom URL" },
    ];
</script>

<div class="mb-1">
    <label
        for={id}
        class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1"
        >{label}</label
    >
    <select
        {id}
        bind:value
        class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full px-4 py-1.5 w-full text-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
    >
        {#each options as option}
            <option value={option.value}>{option.label}</option>
        {/each}
    </select>
</div>
