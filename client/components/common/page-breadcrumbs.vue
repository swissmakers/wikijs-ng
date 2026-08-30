<template lang="pug">
  v-breadcrumbs.breadcrumbs-nav.pl-0(
    :items='breadcrumbs'
    divider='/'
    )
    template(slot='item', slot-scope='props')
      v-icon(v-if='props.item.path === "/"', small, @click='goHome') mdi-home
      v-btn.ma-0(v-else-if='currentDisabled && props.item.path === currentAbsolutePath', small, text, disabled) {{props.item.name}}
      v-btn.ma-0(v-else, :href='props.item.path', small, text) {{props.item.name}}
</template>

<script>
import _ from 'lodash'

/* global siteLangs */

export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: ''
    },
    currentDisabled: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      locales: siteLangs
    }
  },
  computed: {
    currentAbsolutePath () {
      return (this.locales.length > 0 ? `/${this.locale}` : '') + `/${this.path}`
    },
    breadcrumbs () {
      return [{ path: '/', name: 'Home' }].concat(
        _.reduce(this.path.split('/'), (result, value) => {
          result.push({
            path: _.get(_.last(result), 'path', this.locales.length > 0 ? `/${this.locale}` : '') + `/${value}`,
            name: value
          })
          return result
        }, []))
    }
  },
  methods: {
    goHome () {
      if (this.locales && this.locales.length > 0) {
        window.location.assign(`/${this.locale}/home`)
      } else {
        window.location.assign('/')
      }
    }
  }
}
</script>

<style lang="scss">
.breadcrumbs-nav {
  .v-btn {
    min-width: 0;
    &__content {
      text-transform: none;
    }
  }

  .v-breadcrumbs__divider:nth-child(2n) {
    padding: 0 6px;
  }
  .v-breadcrumbs__divider:nth-child(2) {
    padding: 0 6px 0 12px;
  }
}
</style>
