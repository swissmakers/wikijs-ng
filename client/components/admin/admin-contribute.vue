<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-heart-health.svg', alt='About', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft About Wiki.js NG
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Project information and support

        v-layout.mt-3(row, wrap)
          v-flex(lg6 xs12)
            v-card.animated.fadeInUp
              v-toolbar(color='primary', dark, dense, flat)
                v-toolbar-title.subtitle-1 Project
              v-card-text
                .body-2.
                  Wiki.js NG is a hardened, actively maintained fork of Wiki.js 2.x,
                  maintained by #[a(href='https://swissmakers.ch', target='_blank', rel='noopener') Swissmakers GmbH].
                v-list(dense, nav)
                  v-list-item(href='https://github.com/swissmakers/wikijs-ng', target='_blank', rel='noopener')
                    v-list-item-avatar: v-icon(color='primary') mdi-github
                    v-list-item-content
                      v-list-item-title Source Code
                      v-list-item-subtitle github.com/swissmakers/wikijs-ng
                  v-list-item(href='https://github.com/swissmakers/wikijs-ng/issues', target='_blank', rel='noopener')
                    v-list-item-avatar: v-icon(color='primary') mdi-bug-outline
                    v-list-item-content
                      v-list-item-title Issues &amp; Feature Requests
                      v-list-item-subtitle Report bugs or suggest improvements
                  v-list-item(href='https://github.com/swissmakers/wikijs-ng/releases', target='_blank', rel='noopener')
                    v-list-item-avatar: v-icon(color='primary') mdi-tag-outline
                    v-list-item-content
                      v-list-item-title Releases &amp; Changelog
                      v-list-item-subtitle What changed in each version

            v-card.mt-4.animated.fadeInUp.wait-p2s
              v-toolbar(color='secondary', dark, dense, flat)
                v-toolbar-title.subtitle-1 Built on Wiki.js
              v-card-text
                .body-2.
                  This project is based on #[a(href='https://github.com/requarks/wiki', target='_blank', rel='noopener') Wiki.js]
                  by Nicolas Giard and contributors, licensed under the
                  #[a(href='https://github.com/swissmakers/wikijs-ng/blob/main/LICENSE', target='_blank', rel='noopener') AGPL-3.0].
                  We are grateful for the years of work that went into the upstream project.

          v-flex(lg6 xs12)
            v-card.animated.fadeInUp.wait-p2s
              v-toolbar(color='primary', dark, dense, flat)
                v-toolbar-title.subtitle-1 Support this project
              v-card-text
                .body-2.
                  If Wiki.js NG is valuable to your organization, please consider supporting
                  its ongoing maintenance and security work.
                v-list(dense, nav)
                  v-list-item(href='https://github.com/sponsors/swissmakers', target='_blank', rel='noopener')
                    v-list-item-avatar: v-icon(color='primary') mdi-heart-outline
                    v-list-item-content
                      v-list-item-title Become a GitHub Sponsor
                      v-list-item-subtitle github.com/sponsors/swissmakers
                  v-list-item(href='https://swissmakers.ch', target='_blank', rel='noopener')
                    v-list-item-avatar: v-icon(color='primary') mdi-briefcase-outline
                    v-list-item-content
                      v-list-item-title Commercial Support &amp; Consulting
                      v-list-item-subtitle swissmakers.ch
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style lang='scss'>
</style>
