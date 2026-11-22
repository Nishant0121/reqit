import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Reqit',
  description:
    'A local-first, Git-native desktop API client. Your requests live as plain YAML files in your repository, next to your code.',
  base: '/reqit/',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/reqit/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Reqit — Git-Native Desktop API Client' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Local-first API testing with plain YAML files in your Git repo. Fast HTTP engine, live file sync, and zero cloud bloat.',
      },
    ],
  ],

  themeConfig: {
    siteTitle: 'Reqit',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'File Format', link: '/format/specification' },
      { text: 'Features', link: '/features/scripting' },
      { text: 'CLI & CI', link: '/features/runner-cli' },
      { text: 'Comparison', link: '/guide/comparison' },
      { text: 'FAQ', link: '/faq' },
      {
        text: 'v1.0.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/Nishant0121/reqit/releases' },
          { text: 'GitHub Releases', link: 'https://github.com/Nishant0121/reqit/releases/latest' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview & Installation', link: '/guide/getting-started' },
          { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
          { text: 'Comparison with Other Tools', link: '/guide/comparison' },
        ],
      },
      {
        text: 'File Format & Variables',
        items: [
          { text: 'YAML Specification', link: '/format/specification' },
          { text: 'Variables & Secrets Hierarchy', link: '/format/variables' },
        ],
      },
      {
        text: 'Features & Capabilities',
        items: [
          { text: 'Pre-Request Scripts & Tests', link: '/features/scripting' },
          { text: 'Collection Runner & Headless CLI', link: '/features/runner-cli' },
          { text: 'Cookies & OAuth 2.0 PKCE', link: '/features/cookies-oauth' },
          { text: 'Importing cURL, Postman & OpenAPI', link: '/features/import-export' },
          { text: 'GraphQL & Introspection', link: '/features/graphql' },
        ],
      },
      {
        text: 'Security & Reference',
        items: [
          { text: 'Security, Sandboxing & Unsigned Builds', link: '/reference/security' },
          { text: 'Frequently Asked Questions', link: '/faq' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/Nishant0121/reqit' }],

    footer: {
      message: 'Released under the MIT License. Committable and 100% offline.',
      copyright: 'Copyright © 2026 Reqit Contributors',
    },
  },
});
