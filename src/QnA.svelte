<script>
  const qna = [
    {
      q: "What is this site?",
      parts: [
        "This site combines auction records from ",
        { text: "Kractero\u2019s Bazaar", href: "https://bazaar.kractero.com/" },
        " and puppet tracking from ",
        { text: "9003\u2019s sheet", href: "https://docs.google.com/spreadsheets/u/0/d/1MZ-4GLWAZDgB1TDvwtssEcVKHKunOKi3l90Jof1pBB4/htmlview#gid=216825393" },
        ", ",
        { text: "XKI\u2019s sheet", href: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSem15AVLXgdjxWBZOnWRFnF6NwkY0gVKPYI8aWuHJzlbyILBL3o1F5GK1hSK3iiBlXLIZBI5jdpkVr/pub?gid=916202163" },
        " and ",
        { text: "our own data", href: "https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/data/static/puppetData.tsv" },
        " to show which users are interacting with any given nation.",
      ],
    },
    {
      q: "Who runs this site?",
      parts: [
        "The site is maintained by Rotenaplistan, and the dataset is primarily maintained by Rotenaplistan and Caffeinated. To contact us please reach out to @rotenaple or @latterstarsigngirl on Discord.",
      ],
    },
    {
      q: "How do I add puppets to this site?",
      parts: [
        "Please use ", { text: "this form", href: "https://forms.gle/DW4CMWAVQ3TDpj25A" }, ".",
      ],
    },
    {
      q: "How do I report puppets that aren\u2019t mine, but attributed to me?",
      parts: [
        "Check which data source the puppet comes from (In settings, enable \"Show Puppet Identification Source\"), then contact the relevant maintainer. For 9003\u2019s sheet use ",
        { text: "this form", href: "https://docs.google.com/forms/d/16t4mlYuSU5p0U9hVkvzKMqP1GRnpdDV7nLNLA9WdFTs/" },
        ", and for our sheet use ", { text: "this form", href: "https://forms.gle/HCPwTSAsLop69cxa7" }, ".\n        If you believe that somebody is maliciously impersonating you, please contact NationStates staff through the ",
        { text: "Getting Help Page", href: "https://www.nationstates.net/page=help" },
        ".",
      ],
    },
    {
      q: "How is your data different from 9003’s sheet?",
      parts: [
        "9003’s sheet is primarily designed for self reporting. Our data is compiled using a wide range of information, which allows us to list more puppets. However, some false positives are difficult to avoid given our approach.",
      ],
    },
    {
      id: "schema",
      q: "Can I make something based off this site or your data?",
    },
  ];

  let showSchemas = false;

  function renderParts(parts) {
    if (!parts) return '';
    return parts.map(p => {
      if (typeof p === 'string') return p;
      return `<a href="${p.href}" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">${p.text}</a>`;
    }).join('');
  }
</script>

<div class="mt-8 space-y-6 pb-20">
  {#each qna as item}
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 qna-card">
      <div class="font-medium text-gray-800 dark:text-gray-200">
        {item.q}
      </div>
      <div class="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {#if item.id === 'schema'}
          <div class="space-y-3">
            <p>
              Yes, however we offer no guarantees that the site or data will remain compatible with your project.
            </p>

            <div>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer select-none"
                on:click={() => showSchemas = !showSchemas}
              >
                <svg class="size-3.5 transition-transform duration-200" class:rotate-90={showSchemas} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span>{showSchemas ? 'Hide data schemas' : 'View data schemas'}</span>
              </button>
            </div>

            {#if showSchemas}
              <div class="space-y-3 pt-1">
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  <span class="text-emerald-600 dark:text-emerald-400 font-semibold">Core fields</span> should remain stable, however additional columns, array values, or metadata may change in the future.
                </p>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- TSV Schema Card -->
                  <div class="bg-gray-50 dark:bg-gray-900/60 midnight:!bg-[#0f1115] border border-gray-200 dark:border-gray-700 midnight:!border-gray-800 rounded-xl p-3.5">
                    <a
                      href="https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/data/static/puppetData.tsv"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline inline-block mb-2 font-medium"
                    >
                      puppetData.tsv
                    </a>

                    <pre class="bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-[11px] font-mono overflow-x-auto text-gray-700 dark:text-gray-300 leading-relaxed"><span class="text-gray-400 dark:text-gray-500"># Header row (tab-separated)</span>
<span class="text-emerald-600 dark:text-emerald-400 font-bold">puppet</span>&#9;<span class="text-emerald-600 dark:text-emerald-400 font-bold">master</span>&#9;sheet&#9;[sheet2&#9;...]

<span class="text-gray-400 dark:text-gray-500"># Data rows (classic 9003 shape in cols 1 &amp; 2)</span>
<span class="text-emerald-600 dark:text-emerald-400 font-semibold">nation_a</span>&#9;<span class="text-emerald-600 dark:text-emerald-400 font-semibold">master_x</span>&#9;sheet_a
<span class="text-emerald-600 dark:text-emerald-400 font-semibold">nation_b</span>&#9;<span class="text-emerald-600 dark:text-emerald-400 font-semibold">master_y</span>&#9;sheet_a&#9;sheet_b</pre>
                  </div>

                  <!-- JSON Schema Card -->
                  <div class="bg-gray-50 dark:bg-gray-900/60 midnight:!bg-[#0f1115] border border-gray-200 dark:border-gray-700 midnight:!border-gray-800 rounded-xl p-3.5">
                    <a
                      href="https://raw.githubusercontent.com/ns-rot/unsmurf/refs/heads/data/static/puppetData.json"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline inline-block mb-2 font-medium"
                    >
                      puppetData.json
                    </a>

                    <pre class="bg-white dark:bg-black/50 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 text-[11px] font-mono overflow-x-auto text-gray-700 dark:text-gray-300 leading-relaxed">&#123;
  "version": 2,
  <span class="text-emerald-600 dark:text-emerald-400 font-semibold">"masters"</span>: [
    <span class="text-emerald-600 dark:text-emerald-400">"master_x"</span>,  <span class="text-gray-400 dark:text-gray-500">// index 0</span>
    <span class="text-emerald-600 dark:text-emerald-400">"master_y"</span>   <span class="text-gray-400 dark:text-gray-500">// index 1</span>
  ],
  "puppets": [
    <span class="text-gray-400 dark:text-gray-500">// [puppetNation, masterIndex, sheetMask]</span>
    <span class="text-gray-400 dark:text-gray-500">// sheetMask: bit n (1 &lt;&lt; n) indicates presence in sheets[n]</span>
    [<span class="text-emerald-600 dark:text-emerald-400 font-semibold">"nation_a"</span>, <span class="text-emerald-600 dark:text-emerald-400 font-semibold">0</span>, 1],
    [<span class="text-emerald-600 dark:text-emerald-400 font-semibold">"nation_b"</span>, <span class="text-emerald-600 dark:text-emerald-400 font-semibold">1</span>, 3]
  ],
  "sheets": [
    "sheet_a",   <span class="text-gray-400 dark:text-gray-500">// bit 0 (1 &lt;&lt; 0 = 1)</span>
    "sheet_b"    <span class="text-gray-400 dark:text-gray-500">// bit 1 (1 &lt;&lt; 1 = 2)</span>
  ]
&#125;</pre>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <p>{@html renderParts(item.parts)}</p>
        {/if}
      </div>
    </div>
  {/each}
</div>
