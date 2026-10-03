import _ from 'lodash'
import { get } from 'vuex-pathify'

/**
 * Page permission getters and the list of secondary page actions,
 * shared by the header page menu and the page speed dial.
 */
export default {
  computed: {
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    /**
     * Actions besides view / edit. The key is the handler name in nav-header
     * (the speed dial emits it on $root).
     */
    pageActions () {
      const mode = this.$store.get('page/mode')
      return _.filter([
        { key: 'pageHistory', icon: 'mdi-history', label: this.$t('common:header.history'), show: mode !== 'history' && this.hasReadHistoryPermission },
        { key: 'pageSource', icon: 'mdi-code-tags', label: this.$t('common:header.viewSource'), show: mode !== 'source' && this.hasReadSourcePermission },
        { key: 'pageExportPdf', icon: 'mdi-file-pdf-box', label: this.$t('common:page.exportPdf', { defaultValue: 'Export as PDF' }), show: mode === 'view' },
        { key: 'pageConvert', icon: 'mdi-lightning-bolt', label: this.$t('common:header.convert'), show: this.hasWritePagesPermission },
        { key: 'pageDuplicate', icon: 'mdi-content-duplicate', label: this.$t('common:header.duplicate'), show: this.hasWritePagesPermission },
        { key: 'pageMove', icon: 'mdi-content-save-move-outline', label: this.$t('common:header.move'), show: this.hasManagePagesPermission },
        { key: 'pageDelete', icon: 'mdi-trash-can-outline', label: this.$t('common:header.delete'), show: this.hasDeletePagesPermission, isDanger: true }
      ], 'show')
    }
  }
}
