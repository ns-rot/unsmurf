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
      q: "Can I make something based off this site or your data?",
      parts: [
        "Yes, however we offer no guarantees that the site or the data will remain compatible with your project.",
      ],
    },
  ];

  function renderParts(parts) {
    return parts.map(p => {
      if (typeof p === 'string') return p;
      return `<a href="${p.href}" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">${p.text}</a>`;
    }).join('');
  }
</script>

<div class="mt-8 space-y-6">
  {#each qna as item}
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 qna-card">
      <div class="font-medium text-gray-800 dark:text-gray-200">
        {item.q}
      </div>
      <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">{@html renderParts(item.parts)}</p>
    </div>
  {/each}
</div>
