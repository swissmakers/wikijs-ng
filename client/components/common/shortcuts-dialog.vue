<template lang="pug">
  v-dialog(v-model='isShown', max-width='460')
    v-card
      .dialog-header.is-short
        v-icon.mr-3(color='white') mdi-keyboard-outline
        span {{ $t('common:shortcuts.title', { defaultValue: 'Keyboard shortcuts' }) }}
      v-card-text.pt-4
        v-simple-table(dense)
          tbody
            tr(v-for='shortcut of shortcuts', :key='shortcut.key')
              td: kbd {{ shortcut.key }}
              td {{ $t(shortcut.i18n, { defaultValue: shortcut.label }) }}
        v-switch.mt-4(
          v-model='disabled'
          inset
          hide-details
          color='primary'
          :label='$t(`common:shortcuts.disable`, { defaultValue: "Disable single-key shortcuts" })'
          )
      v-card-chin
        v-spacer
        v-btn(text, @click='isShown = false') {{ $t('common:actions.close') }}
</template>

<script>
import { SHORTCUTS, isDisabled, setDisabled } from '@/helpers/hotkeys'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      shortcuts: SHORTCUTS,
      disabled: isDisabled()
    }
  },
  computed: {
    isShown: {
      get () { return this.value },
      set (val) { this.$emit('input', val) }
    }
  },
  watch: {
    disabled (val) {
      setDisabled(val)
    }
  }
}
</script>
