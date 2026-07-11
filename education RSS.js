// This is the list of places we pull from.
// Turn a source on or off with "enabled".
// To add a new feed, copy one block and change the values.
//
// GOOGLE NEWS RSS is the workhorse. It is free, needs no key,
// and updates within minutes. Change the words after "q=".
// Spaces become "+". Use "OR" between words for "any of these".
// Use "site:example.com" to pull from one site only.
// Change "hl=en-IN&gl=IN&ceid=IN:en" to "hl=bn..." for Bengali.

export const sources = [
  // ---------------------------------------------------------------
  // NEWS
  // ---------------------------------------------------------------
  {
    name: "Google News — Education",
    type: "rss",
    category: "news",
    url: "https://news.google.com/rss/search?q=education+news+india&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Google News — CBSE / NEET / JEE",
    type: "rss",
    category: "news",
    url: "https://news.google.com/rss/search?q=CBSE+OR+NEET+OR+JEE+news&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "The Hindu — Education (direct feed, test it)",
    type: "rss",
    category: "news",
    url: "https://www.thehindu.com/education/feeder/default.rss",
    enabled: true,
  },
  {
    name: "Indian Express — Education (direct feed, test it)",
    type: "rss",
    category: "news",
    url: "https://indianexpress.com/section/education/feed/",
    enabled: true,
  },

  // ---------------------------------------------------------------
  // JOBS
  // ---------------------------------------------------------------
  {
    name: "Google News — Government Jobs",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=sarkari+naukri+recruitment+notification&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Google News — Bank / SSC / Railway Jobs",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=SSC+OR+IBPS+OR+railway+recruitment+2026&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Google News — West Bengal Jobs",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=WBPSC+OR+WBSSC+recruitment&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Jagran Josh via Google News (safe way to pull their content)",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=site:jagranjosh.com&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },

  // ---------------------------------------------------------------
  // RESULTS
  // For results, we save the LINK to the official page.
  // We do not pull student results in bulk. That is personal data.
  // ---------------------------------------------------------------
  {
    name: "Google News — Exam Results & Admit Cards",
    type: "rss",
    category: "result",
    url: "https://news.google.com/rss/search?q=board+exam+result+OR+admit+card+india&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Google News — West Bengal Board Results",
    type: "rss",
    category: "result",
    url: "https://news.google.com/rss/search?q=WBBSE+OR+WBCHSE+OR+Madhyamik+OR+%22higher+secondary%22+result&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },

  // ---------------------------------------------------------------
  // SCHOLARSHIPS
  // ---------------------------------------------------------------
  {
    name: "Google News — Scholarships",
    type: "rss",
    category: "scholarship",
    url: "https://news.google.com/rss/search?q=scholarship+students+india+apply&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },
  {
    name: "Google News — National Scholarship Portal",
    type: "rss",
    category: "scholarship",
    url: "https://news.google.com/rss/search?q=national+scholarship+portal+OR+NSP+scholarship&hl=en-IN&gl=IN&ceid=IN:en",
    enabled: true,
  },

  // ---------------------------------------------------------------
  // BENGALI (বাংলা) — for your West Bengal students
  // These pull Bengali-language news, jobs, results and scholarships.
  // They are legal: you get a headline, a short snippet, and a link.
  // Note: we do NOT copy the Karmasangsthan paper. It is copyrighted.
  // These feeds give you the same job facts, in Bengali, the safe way.
  // ---------------------------------------------------------------
  {
    name: "Bengali — Job News (চাকরির খবর)",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF%E0%A6%B0%20%E0%A6%96%E0%A6%AC%E0%A6%B0%20%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali — WB Government Jobs (সরকারি চাকরি)",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97%20%E0%A6%B8%E0%A6%B0%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A6%BF%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF%20%E0%A6%A8%E0%A6%BF%E0%A6%AF%E0%A6%BC%E0%A7%8B%E0%A6%97&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali — Anandabazar Jobs (via Google News)",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=site%3Aanandabazar.com%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali — Ei Samay Jobs (via Google News)",
    type: "rss",
    category: "job",
    url: "https://news.google.com/rss/search?q=site%3Aeisamay.com%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali — Results, Madhyamik / HS (রেজাল্ট)",
    type: "rss",
    category: "result",
    url: "https://news.google.com/rss/search?q=%E0%A6%AE%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%AE%E0%A6%BF%E0%A6%95%20%E0%A6%89%E0%A6%9A%E0%A7%8D%E0%A6%9A%E0%A6%AE%E0%A6%BE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%AE%E0%A6%BF%E0%A6%95%20%E0%A6%B0%E0%A7%87%E0%A6%9C%E0%A6%BE%E0%A6%B2%E0%A7%8D%E0%A6%9F&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali — Scholarships (স্কলারশিপ)",
    type: "rss",
    category: "scholarship",
    url: "https://news.google.com/rss/search?q=%E0%A6%B8%E0%A7%8D%E0%A6%95%E0%A6%B2%E0%A6%BE%E0%A6%B0%E0%A6%B6%E0%A6%BF%E0%A6%AA%20%E0%A6%AA%E0%A6%B6%E0%A7%8D%E0%A6%9A%E0%A6%BF%E0%A6%AE%E0%A6%AC%E0%A6%99%E0%A7%8D%E0%A6%97%20%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A5%E0%A7%80&hl=bn&gl=IN&ceid=IN:bn",
    enabled: true,
  },
  {
    name: "Bengali OneIndia — News (direct feed, test it)",
    type: "rss",
    category: "news",
    url: "https://bengali.oneindia.com/rss/",
    enabled: true,
  },

  // ---------------------------------------------------------------
  // GOVERNMENT OPEN DATA via data.gov.in (needs a free key)
  // Steps:
  //   1) Get a key at https://data.gov.in
  //   2) Find a dataset (for example, National Career Service jobs).
  //   3) Open it and copy the "resource id" from the API link.
  //   4) Paste it below. Set enabled to true. Put your key in .env.
  //   5) Change the "fieldMap" names to match the real column names.
  // ---------------------------------------------------------------
  {
    name: "data.gov.in — NCS Jobs",
    type: "datagovin",
    category: "job",
    resourceId: "PASTE_RESOURCE_ID_HERE",
    fieldMap: {
      title: "job_title",
      summary: "job_description",
      sourceUrl: "url",
      sourceDate: "date",
    },
    enabled: false,
  },
];
