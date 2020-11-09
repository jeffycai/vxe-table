import { defineComponent, h, PropType, ref, Ref, computed, provide, resolveComponent, ComponentOptions, reactive, onUnmounted, watch, nextTick, VNode } from 'vue'
import XEUtils from 'xe-utils/ctor'
import { UtilTools, DomTools, GlobalEvent } from '../../tools'
import GlobalConfig from '../../conf'
import VXETable from '../../v-x-e-table'
import tableComponentProps from '../../table/src/props'
import tableComponentEmits from '../../table/src/emits'
import { useSize } from '../../hooks/size'
import { clearTableDefaultStatus, clearTableAllStatus } from '../../table/src/util'

import { TableMethods, VxeGridConstructor, VxeGridEmits, GridReactData, VxeGridPropTypes, VxeToolbarPropTypes, GridMethods, GridPrivateMethods, VxeGridPrivateComputed, VxeGridPrivateMethods, VxeTableInstance, VxeToolbarInstance, GridPrivateRef } from '../../../types/vxe-table'

function getOffsetHeight (elem: HTMLElement) {
  return elem ? elem.offsetHeight : 0
}

function getPaddingTopBottomSize (elem: HTMLElement) {
  const computedStyle = getComputedStyle(elem)
  const paddingTop = XEUtils.toNumber(computedStyle.paddingTop)
  const paddingBottom = XEUtils.toNumber(computedStyle.paddingBottom)
  return paddingTop + paddingBottom
}

const tableComponentPropKeys = Object.keys(tableComponentProps as any)

const tableComponentMethodKeys = 'clearAll,syncData,updateData,loadData,reloadData,reloadRow,loadColumn,reloadColumn,getRowNode,getColumnNode,getRowIndex,getVTRowIndex,getVMRowIndex,getColumnIndex,getVTColumnIndex,getVMColumnIndex,createData,createRow,revertData,clearData,isInsertByRow,isUpdateByRow,getColumns,getColumnById,getColumnByField,getTableColumn,getData,getCheckboxRecords,getRowById,getRowid,getTableData,hideColumn,showColumn,resetColumn,refreshColumn,refreshScroll,recalculate,clostTooltip,isAllCheckboxChecked,isCheckboxIndeterminate,getCheckboxIndeterminateRecords,setCheckboxRow,isCheckedByCheckboxRow,toggleCheckboxRow,setAllCheckboxRow,getRadioReserveRecord,clearRadioReserve,getCheckboxReserveRecords,clearCheckboxReserve,toggleAllCheckboxRow,clearCheckboxRow,setCurrentRow,isCheckedByRadioRow,setRadioRow,clearCurrentRow,clearRadioRow,getCurrentRecord,getRadioRecord,getCurrentColumn,setCurrentColumn,clearCurrentColumn,sort,clearSort,isSort,getSortColumns,closeFilter,isFilter,isRowExpandLoaded,clearRowExpandLoaded,reloadExpandContent,toggleRowExpand,setAllRowExpand,setRowExpand,isExpandByRow,clearRowExpand,clearRowExpandReserve,getRowExpandRecords,getTreeExpandRecords,isTreeExpandLoaded,clearTreeExpandLoaded,reloadTreeChilds,toggleTreeExpand,setAllTreeExpand,setTreeExpand,isTreeExpandByRow,clearTreeExpand,clearTreeExpandReserve,getScroll,scrollTo,scrollToRow,scrollToColumn,clearScroll,updateFooter,updateStatus,setMergeCells,removeMergeCells,getMergeCells,clearMergeCells,setMergeFooterItems,removeMergeFooterItems,getMergeFooterItems,clearMergeFooterItems,focus,blur,connect'.split(',') as (keyof TableMethods)[]

export default defineComponent({
  name: 'VxeGrid',
  props: {
    ...tableComponentProps,
    columns: Array as PropType<VxeGridPropTypes.Columns>,
    pagerConfig: Object as PropType<VxeGridPropTypes.PagerConfig>,
    proxyConfig: Object as PropType<VxeGridPropTypes.ProxyConfig>,
    toolbarConfig: Object as PropType<VxeGridPropTypes.ToolbarConfig>,
    formConfig: Object as PropType<VxeGridPropTypes.FormConfig>,
    zoomConfig: Object as PropType<VxeGridPropTypes.ZoomConfig>,
    size: { type: String as PropType<VxeGridPropTypes.Size>, default: () => GlobalConfig.grid.size || GlobalConfig.size }
  },
  emits: [
    ...tableComponentEmits,
    'page-change',
    'form-submit',
    'form-submit-invalid',
    'form-reset',
    'form-toggle-collapse',
    'toolbar-button-click',
    'zoom'
  ] as VxeGridEmits,
  setup (props, context) {
    const TableComponent = resolveComponent('vxe-table') as ComponentOptions
    const FormComponent = resolveComponent('vxe-form') as ComponentOptions
    const ToolbarComponent = resolveComponent('vxe-toolbar') as ComponentOptions
    const PagerComponent = resolveComponent('vxe-pager') as ComponentOptions

    const { slots, emit } = context

    const xID = XEUtils.uniqueId()

    const computeSize = useSize(props)

    const reactData = reactive({
      tableLoading: false,
      proxyInited: false,
      isZMax: false,
      tableData: [],
      pendingRecords: [],
      filterData: [],
      formData: {},
      sortData: [],
      tZindex: 0,
      tablePage: {
        total: 0,
        pageSize: 10,
        currentPage: 1
      }
    } as GridReactData)

    const refElem = ref() as Ref<HTMLDivElement>
    const refTable = ref() as Ref<VxeTableInstance>
    const refToolbar = ref() as Ref<VxeToolbarInstance>

    const refFormWrapper = ref() as Ref<HTMLDivElement>
    const refToolbarWrapper = ref() as Ref<HTMLDivElement>
    const refTopWrapper = ref() as Ref<HTMLDivElement>
    const refBottomWrapper = ref() as Ref<HTMLDivElement>
    const refPagerWrapper = ref() as Ref<HTMLDivElement>

    const gridExtendTableMethods = {} as TableMethods

    tableComponentMethodKeys.forEach(name => {
      gridExtendTableMethods[name] = (...args: any[]) => {
        const $xetable: any = refTable.value
        return $xetable && $xetable[name](...args)
      }
    })

    const computeProxyOpts = computed(() => {
      return Object.assign({}, GlobalConfig.grid.proxyConfig, props.proxyConfig) as VxeGridPropTypes.ProxyConfig
    })

    const computeIsMsg = computed(() => {
      const proxyOpts = computeProxyOpts.value
      return proxyOpts.message !== false
    })

    const computePagerOpts = computed(() => {
      return Object.assign({}, GlobalConfig.grid.pagerConfig, props.pagerConfig) as VxeGridPropTypes.PagerConfig
    })

    const computeFormOpts = computed(() => {
      return Object.assign({}, GlobalConfig.grid.formConfig, props.formConfig) as VxeGridPropTypes.FormOpts
    })

    const computeToolbarOpts = computed(() => {
      return Object.assign({}, GlobalConfig.grid.toolbarConfig, props.toolbarConfig) as VxeGridPropTypes.ToolbarOpts
    })

    const computeZoomOpts = computed(() => {
      return Object.assign({}, GlobalConfig.grid.zoomConfig, props.zoomConfig)
    })

    const computeStyles = computed(() => {
      return reactData.isZMax ? { zIndex: reactData.tZindex } : null
    })

    const computeTableExtendProps = computed(() => {
      const rest: any = {}
      const gridProps: any = props
      tableComponentPropKeys.forEach((key) => {
        rest[key] = gridProps[key]
      })
      return rest
    })

    const refMaps: GridPrivateRef = {
      refElem
    }

    const computeMaps: VxeGridPrivateComputed = {
      computeProxyOpts
    }

    const $xegrid = {
      xID,
      props,
      context,
      reactData,
      refMaps,
      computeMaps
    } as VxeGridConstructor & VxeGridPrivateMethods

    let gridMethods = {} as GridMethods

    const handleRowClassName = (params: any) => {
      const rowClassName = props.rowClassName
      const clss = []
      if (reactData.pendingRecords.some((item: any) => item === params.row)) {
        clss.push('row--pending')
      }
      return clss.push(rowClassName ? XEUtils.isFunction(rowClassName) ? rowClassName(params) : rowClassName : '')
    }

    const handleActiveMethod = (params: any) => {
      const { editConfig } = props
      const activeMethod = editConfig ? editConfig.activeMethod : null
      return reactData.pendingRecords.indexOf(params.row) === -1 && (!activeMethod || activeMethod(params))
    }

    const computeTableProps = computed(() => {
      const { seqConfig, pagerConfig, loading, editConfig, proxyConfig } = props
      const { isZMax, tableLoading, tablePage, tableData } = reactData
      const tableExtendProps = computeTableExtendProps.value
      const proxyOpts = computeProxyOpts.value
      const tableProps = Object.assign({}, tableExtendProps)
      if (isZMax) {
        if (tableExtendProps.maxHeight) {
          tableProps.maxHeight = 'auto'
        } else {
          tableProps.height = 'auto'
        }
      }
      if (proxyConfig) {
        tableProps.loading = loading || tableLoading
        tableProps.data = tableData
        tableProps.rowClassName = handleRowClassName
        if ((proxyOpts.seq || proxyOpts.index) && pagerConfig) {
          tableProps.seqConfig = Object.assign({}, seqConfig, { startIndex: (tablePage.currentPage - 1) * tablePage.pageSize })
        }
      }
      if (editConfig) {
        tableProps.editConfig = Object.assign({}, editConfig, { activeMethod: handleActiveMethod })
      }
      return tableProps
    })

    const computePagerProps = computed(() => {
      const pagerOpts = computePagerOpts.value
      return Object.assign({}, pagerOpts, props.proxyConfig ? reactData.tablePage : {})
    })

    const initToolbar = () => {
      nextTick(() => {
        const $xetable = refTable.value
        const $xetoolbar = refToolbar.value
        if ($xetable && $xetoolbar) {
          $xetable.connect($xetoolbar)
        }
      })
    }

    const initPages = () => {
      const { pagerConfig } = props
      const { tablePage } = reactData
      const pagerOpts = computePagerOpts.value
      const { currentPage, pageSize } = pagerOpts
      if (pagerConfig) {
        if (currentPage) {
          tablePage.currentPage = currentPage
        }
        if (pageSize) {
          tablePage.pageSize = pageSize
        }
      }
    }

    const triggerPendingEvent = (code: string) => {
      const { pendingRecords } = reactData
      const isMsg = computeIsMsg.value
      const $xetable = refTable.value
      const selectRecords = $xetable.getCheckboxRecords()
      if (selectRecords.length) {
        const plus: any[] = []
        const minus: any[] = []
        selectRecords.forEach((data: any) => {
          if (pendingRecords.some((item: any) => data === item)) {
            minus.push(data)
          } else {
            plus.push(data)
          }
        })
        if (minus.length) {
          reactData.pendingRecords = pendingRecords.filter((item) => minus.indexOf(item) === -1).concat(plus)
        } else if (plus.length) {
          reactData.pendingRecords = pendingRecords.concat(plus)
        }
        gridExtendTableMethods.clearCheckboxRow()
      } else {
        if (isMsg) {
          VXETable.modal.message({ id: code, message: GlobalConfig.i18n('vxe.grid.selectOneRecord'), status: 'warning' })
        }
      }
    }

    const getRespMsg = (rest: any, defaultMsg: string) => {
      const proxyOpts = computeProxyOpts.value
      const { props: proxyProps = {} } = proxyOpts
      let msg
      if (rest && proxyProps.message) {
        msg = XEUtils.get(rest, proxyProps.message)
      }
      return msg || GlobalConfig.i18n(defaultMsg)
    }

    const handleDeleteRow = (code: string, alertKey: string, callback: Function) => {
      const isMsg = computeIsMsg.value
      const selectRecords = gridExtendTableMethods.getCheckboxRecords()
      if (isMsg) {
        if (selectRecords.length) {
          return VXETable.modal.confirm({ id: `cfm_${code}`, message: GlobalConfig.i18n(alertKey), escClosable: true }).then((type) => {
            if (type === 'confirm') {
              callback()
            }
          })
        } else {
          VXETable.modal.message({ id: `msg_${code}`, message: GlobalConfig.i18n('vxe.grid.selectOneRecord'), status: 'warning' })
        }
      } else {
        if (selectRecords.length) {
          callback()
        }
      }
      return Promise.resolve()
    }

    const pageChangeEvent = (params: any) => {
      const { proxyConfig } = props
      const { tablePage } = reactData
      const { currentPage, pageSize } = params
      tablePage.currentPage = currentPage
      tablePage.pageSize = pageSize
      gridMethods.dispatchEvent('page-change', params)
      if (proxyConfig) {
        gridMethods.commitProxy('query')
      }
    }

    const sortChangeEvent = (params: any) => {
      const $xetable = refTable.value
      const { proxyConfig } = props
      const { computeMaps: tableComputeMaps } = $xetable
      const { computeSortOpts } = tableComputeMaps
      const sortOpts = computeSortOpts.value
      // 如果是服务端排序
      if (sortOpts.remote) {
        reactData.sortData = params.sortList
        if (proxyConfig) {
          reactData.tablePage.currentPage = 1
          gridMethods.commitProxy('query')
        }
      }
      gridMethods.dispatchEvent('sort-change', params)
    }

    const filterChangeEvent = (params: any) => {
      const $xetable = refTable.value
      const { proxyConfig } = props
      const { computeMaps: tableComputeMaps } = $xetable
      const { computeFilterOpts } = tableComputeMaps
      const filterOpts = computeFilterOpts.value
      // 如果是服务端过滤
      if (filterOpts.remote) {
        reactData.filterData = params.filters
        if (proxyConfig) {
          reactData.tablePage.currentPage = 1
          gridMethods.commitProxy('query')
        }
      }
      gridMethods.dispatchEvent('filter-change', params)
    }

    const submitEvent = (params: any) => {
      const { proxyConfig } = props
      if (proxyConfig) {
        gridMethods.commitProxy('reload')
      }
      gridMethods.dispatchEvent('form-submit', params)
    }

    const resetEvent = (params: any) => {
      const { proxyConfig } = props
      if (proxyConfig) {
        gridMethods.commitProxy('reload')
      }
      gridMethods.dispatchEvent('form-reset', params)
    }

    const submitInvalidEvent = (params: any) => {
      gridMethods.dispatchEvent('form-submit-invalid', params)
    }

    const togglCollapseEvent = (params: any) => {
      nextTick(() => gridExtendTableMethods.recalculate(true))
      gridMethods.dispatchEvent('form-toggle-collapse', params)
    }

    const handleZoom = (isMax?: boolean) => {
      const { isZMax } = reactData
      if (isMax ? !isZMax : isZMax) {
        reactData.isZMax = !isZMax
        if (reactData.tZindex < UtilTools.getLastZIndex()) {
          reactData.tZindex = UtilTools.nextZIndex()
        }
      }
      return nextTick().then(() => gridExtendTableMethods.recalculate(true)).then(() => reactData.isZMax)
    }

    /**
     * 渲染表单
     */
    const renderForms = () => {
      const { formConfig, proxyConfig } = props
      const { formData } = reactData
      const proxyOpts = computeProxyOpts.value
      const formOpts = computeFormOpts.value
      const restVNs = []
      if (formConfig || slots.form) {
        let slotVNs = []
        if (slots.form) {
          slotVNs = slots.form({ $grid: $xegrid })
        } else {
          if (formOpts.items) {
            if (!formOpts.inited) {
              formOpts.inited = true
              const beforeItem = proxyOpts.beforeItem
              if (proxyOpts && beforeItem) {
                formOpts.items.forEach((item) => {
                  beforeItem({ $grid: $xegrid, item })
                })
              }
            }
            slotVNs.push(
              h(FormComponent, {
                ...Object.assign({}, formOpts, {
                  data: proxyConfig && proxyOpts.form ? formData : formOpts.data
                }),
                onSubmit: submitEvent,
                onReset: resetEvent,
                onSubmitInvalid: submitInvalidEvent,
                onToggleCollapse: togglCollapseEvent
              })
            )
          }
        }
        restVNs.push(
          h('div', {
            ref: refFormWrapper,
            class: 'vxe-grid--form-wrapper'
          }, slotVNs)
        )
      }
      return restVNs
    }

    /**
     * 渲染工具栏
     */
    const renderToolbars = () => {
      const { toolbarConfig } = props
      const toolbarOpts = computeToolbarOpts.value
      const restVNs = []
      if (toolbarConfig || slots.toolbar) {
        let slotVNs = []
        if (slots.toolbar) {
          slotVNs = slots.toolbar({ $grid: $xegrid })
        } else {
          const toolbarOptSlots = toolbarOpts.slots
          let buttonsSlot: any
          let toolsSlot: any
          const toolbarSlots: { [key: string]: () => VNode[] } = {}
          if (toolbarOptSlots) {
            buttonsSlot = toolbarOptSlots.buttons
            toolsSlot = toolbarOptSlots.tools
            if (buttonsSlot && slots[buttonsSlot]) {
              buttonsSlot = slots[buttonsSlot]
            }
            if (toolsSlot && slots[toolsSlot]) {
              toolsSlot = slots[toolsSlot]
            }
          }
          if (buttonsSlot) {
            toolbarSlots.buttons = buttonsSlot
          }
          if (toolsSlot) {
            toolbarSlots.tools = toolsSlot
          }
          slotVNs.push(
            h(ToolbarComponent, {
              ref: refToolbar,
              ...toolbarOpts
            }, toolbarSlots)
          )
        }
        restVNs.push(
          h('div', {
            ref: refToolbarWrapper,
            class: 'vxe-grid--toolbar-wrapper'
          }, slotVNs)
        )
      }
      return restVNs
    }

    /**
     * 渲染表格顶部区域
     */
    const renderTops = () => {
      if (slots.top) {
        return [
          h('div', {
            ref: refTopWrapper,
            class: 'vxe-grid--top-wrapper'
          }, slots.top({ $grid: $xegrid }))
        ]
      }
      return []
    }

    /**
     * 渲染表格
     */
    const renderTables = () => {
      const { proxyConfig } = props
      const tableProps = computeTableProps.value
      const proxyOpts = computeProxyOpts.value
      const ons: any = {}
      // getOnKeys().forEach(type => {
      //   ons[getOnName(type)] = (...args: any[]) => emit(type, ...args)
      // })
      if (proxyConfig) {
        if (proxyOpts.sort) {
          ons.onSortChange = sortChangeEvent
        }
        if (proxyOpts.filter) {
          ons.onFilterChange = filterChangeEvent
        }
      }
      return [
        h(TableComponent, {
          ref: refTable,
          ...tableProps,
          ...ons
        }, {
          empty: () => slots.empty ? slots.empty({}) : []
        })
      ]
    }

    /**
     * 渲染表格底部区域
     */
    const renderBottoms = () => {
      if (slots.bottom) {
        return [
          h('div', {
            ref: refBottomWrapper,
            class: 'vxe-grid--bottom-wrapper'
          }, slots.bottom({ $grid: $xegrid }))
        ]
      }
      return []
    }

    /**
     * 渲染分页
     */
    const renderPagers = () => {
      const { pagerConfig } = props
      const pagerProps = computePagerProps.value
      const pagerOpts = computePagerOpts.value
      const restVNs = []
      if (pagerConfig || slots.pager) {
        let slotVNs = []
        if (slots.pager) {
          slotVNs = slots.pager({ $grid: $xegrid })
        } else {
          const pagerOptSlots = pagerOpts.slots
          const pagerSlots: { [key: string]: () => VNode[] } = {}
          let leftSlot: any
          let rightSlot: any
          if (pagerOptSlots) {
            leftSlot = pagerOptSlots.left
            rightSlot = pagerOptSlots.right
            if (leftSlot && slots[leftSlot]) {
              leftSlot = slots[leftSlot]
            }
            if (rightSlot && slots[rightSlot]) {
              rightSlot = slots[rightSlot]
            }
          }
          if (leftSlot) {
            pagerSlots.left = leftSlot
          }
          if (rightSlot) {
            pagerSlots.right = rightSlot
          }
          slotVNs.push(
            h(PagerComponent, {
              ...pagerProps,
              onPageChange: pageChangeEvent
            }, pagerSlots)
          )
        }
        restVNs.push(
          h('div', {
            ref: refPagerWrapper,
            class: 'vxe-grid--pager-wrapper'
          }, slotVNs)
        )
      }
      return restVNs
    }

    const initProxy = () => {
      const { proxyConfig, formConfig } = props
      const { proxyInited } = reactData
      const proxyOpts = computeProxyOpts.value
      const formOpts = computeFormOpts.value
      if (proxyConfig) {
        if (formConfig && proxyOpts.form && formOpts.items) {
          const formData: any = {}
          formOpts.items.forEach(({ field, itemRender }: any) => {
            if (field) {
              formData[field] = itemRender && !XEUtils.isUndefined(itemRender.defaultValue) ? itemRender.defaultValue : undefined
            }
          })
          reactData.formData = formData
        }
        if (!proxyInited && proxyOpts.autoLoad !== false) {
          reactData.proxyInited = true
          nextTick(() => gridMethods.commitProxy('init'))
        }
      }
    }

    gridMethods = {
      dispatchEvent (type, params, evnt) {
        emit(type, Object.assign({ $grid: $xegrid, $event: evnt }, params))
      },
      loadColumn (columns) {
        const $xetable = refTable.value
        XEUtils.eachTree(columns, (column) => {
          if (column.slots) {
            XEUtils.each(column.slots, (func, name, colSlots: any) => {
              if (!XEUtils.isFunction(func)) {
                if (slots[func]) {
                  colSlots[name] = slots[func]
                } else {
                  colSlots[name] = null
                  UtilTools.error('vxe.error.notSlot', [func])
                }
              }
            })
          }
        })
        return $xetable.loadColumn(columns)
      },
      reloadColumn (columns) {
        gridExtendTableMethods.clearAll()
        return gridMethods.loadColumn(columns)
      },
      /**
       * 提交指令，支持 code 或 button
       * @param {String/Object} code 字符串或对象
       */
      commitProxy (proxyTarget: string | VxeToolbarPropTypes.ButtonConfig, ...args: any[]) {
        const { toolbarConfig, pagerConfig } = props
        const { tablePage, sortData, filterData, formData } = reactData
        const isMsg = computeIsMsg.value
        const proxyOpts = computeProxyOpts.value
        const toolbarOpts = computeToolbarOpts.value
        const { beforeQuery, afterQuery, beforeDelete, afterDelete, beforeSave, afterSave, ajax = {}, props: proxyProps = {} } = proxyOpts
        const $xetable = refTable.value
        let button: VxeToolbarPropTypes.ButtonConfig | null = null
        let code: string | null = null
        if (XEUtils.isString(proxyTarget)) {
          const { buttons } = toolbarOpts
          const matchObj = toolbarConfig && buttons ? XEUtils.findTree(buttons, (item) => item.code === proxyTarget, { children: 'dropdowns' }) : null
          button = matchObj ? matchObj.item : null
          code = proxyTarget
        } else {
          button = proxyTarget
          code = button.code as string
        }
        const btnParams = button ? button.params : null
        switch (code) {
          case 'insert':
            $xetable.insert({})
            break
          case 'insert_actived':
            $xetable.insert({}).then(({ row }: any) => $xetable.setActiveRow(row))
            break
          case 'mark_cancel':
            triggerPendingEvent(code)
            break
          case 'remove':
            return handleDeleteRow(code, 'vxe.grid.removeSelectRecord', () => $xetable.removeCheckboxRow())
          case 'import':
            $xetable.importData(btnParams)
            break
          case 'open_import':
            $xetable.openImport(btnParams)
            break
          case 'export':
            $xetable.exportData(btnParams)
            break
          case 'open_export':
            $xetable.openExport(btnParams)
            break
          case 'reset_custom':
            $xetable.resetColumn(true)
            break
          case 'init':
          case 'reload':
          case 'query': {
            const isInited = code === 'init'
            const isReload = code === 'reload'
            const ajaxMethods = ajax.query
            if (ajaxMethods) {
              const params: any = {
                code,
                button,
                $grid: $xegrid,
                sort: sortData.length ? sortData[0] : {},
                sorts: sortData,
                filters: filterData,
                form: formData,
                options: ajaxMethods
              }
              if (pagerConfig) {
                if (isReload) {
                  tablePage.currentPage = 1
                }
                params.page = tablePage
              }
              if (isInited || isReload) {
                const checkedFilters = isInited ? $xetable.getCheckedFilters() : []
                let sortParams: any[] = []
                const { computeMaps: tableComputeMaps } = $xetable
                const { computeSortOpts } = tableComputeMaps
                const sortOpts = computeSortOpts.value
                let { defaultSort } = sortOpts
                // 如果使用默认排序
                if (defaultSort) {
                  if (!XEUtils.isArray(defaultSort)) {
                    defaultSort = [defaultSort]
                  }
                  sortParams = defaultSort
                }
                reactData.sortData = params.sorts = sortParams
                reactData.filterData = params.filters = isInited ? checkedFilters : []
                reactData.pendingRecords = []
                params.sort = params.sorts.length ? params.sorts[0] : {}
                nextTick(() => {
                  if (isInited) {
                    clearTableDefaultStatus($xetable)
                  } else {
                    clearTableAllStatus($xetable)
                  }
                })
              }
              const applyArgs = [params].concat(args)
              reactData.tableLoading = true
              return Promise.resolve((beforeQuery || ajaxMethods)(...applyArgs))
                .catch(e => e)
                .then(rest => {
                  reactData.tableLoading = false
                  if (rest) {
                    if (pagerConfig) {
                      tablePage.total = XEUtils.get(rest, proxyProps.total || 'page.total') || 0
                      reactData.tableData = XEUtils.get(rest, proxyProps.result || 'result') || []
                    } else {
                      reactData.tableData = (proxyProps.list ? XEUtils.get(rest, proxyProps.list) : rest) || []
                    }
                  } else {
                    reactData.tableData = []
                  }
                  if (afterQuery) {
                    afterQuery(...applyArgs)
                  }
                })
            } else {
              UtilTools.error('vxe.error.notFunc', ['query'])
            }
            break
          }
          case 'delete': {
            const ajaxMethods = ajax.delete
            if (ajaxMethods) {
              const removeRecords = gridExtendTableMethods.getCheckboxRecords()
              const body = { removeRecords }
              const applyArgs = [{ $grid: $xegrid, code, button, body, options: ajaxMethods }].concat(args)
              if (removeRecords.length) {
                return handleDeleteRow(code, 'vxe.grid.deleteSelectRecord', () => {
                  reactData.tableLoading = true
                  return Promise.resolve((beforeDelete || ajaxMethods)(...applyArgs))
                    .then(rest => {
                      reactData.tableLoading = false
                      reactData.pendingRecords = reactData.pendingRecords.filter((row) => removeRecords.indexOf(row) === -1)
                      if (isMsg) {
                        VXETable.modal.message({ message: getRespMsg(rest, 'vxe.grid.delSuccess'), status: 'success' })
                      }
                      if (afterDelete) {
                        afterDelete(...applyArgs)
                      } else {
                        gridMethods.commitProxy('query')
                      }
                    })
                    .catch(rest => {
                      reactData.tableLoading = false
                      if (isMsg) {
                        VXETable.modal.message({ id: code, message: getRespMsg(rest, 'vxe.grid.operError'), status: 'error' })
                      }
                    })
                })
              } else {
                if (isMsg) {
                  VXETable.modal.message({ id: code, message: GlobalConfig.i18n('vxe.grid.selectOneRecord'), status: 'warning' })
                }
              }
            } else {
              UtilTools.error('vxe.error.notFunc', [code])
            }
            break
          }
          case 'save': {
            const ajaxMethods = ajax.save
            if (ajaxMethods) {
              const body = Object.assign({ pendingRecords: reactData.pendingRecords }, $xetable.getRecordset())
              const { insertRecords, removeRecords, updateRecords, pendingRecords } = body
              const applyArgs = [{ $grid: $xegrid, code, button, body, options: ajaxMethods }].concat(args)
              // 排除掉新增且标记为删除的数据
              if (insertRecords.length) {
                body.pendingRecords = pendingRecords.filter((row: any) => insertRecords.indexOf(row) === -1)
              }
              // 排除已标记为删除的数据
              if (pendingRecords.length) {
                body.insertRecords = insertRecords.filter((row: any) => pendingRecords.indexOf(row) === -1)
              }
              // 只校验新增和修改的数据
              return $xetable.validate(body.insertRecords.concat(updateRecords)).then(() => {
                if (body.insertRecords.length || removeRecords.length || updateRecords.length || body.pendingRecords.length) {
                  reactData.tableLoading = true
                  return Promise.resolve((beforeSave || ajaxMethods)(...applyArgs))
                    .then(rest => {
                      reactData.tableLoading = false
                      reactData.pendingRecords = []
                      if (isMsg) {
                        VXETable.modal.message({ message: getRespMsg(rest, 'vxe.grid.saveSuccess'), status: 'success' })
                      }
                      if (afterSave) {
                        afterSave(...applyArgs)
                      } else {
                        gridMethods.commitProxy('query')
                      }
                    })
                    .catch(rest => {
                      reactData.tableLoading = false
                      if (isMsg) {
                        VXETable.modal.message({ id: code, message: getRespMsg(rest, 'vxe.grid.operError'), status: 'error' })
                      }
                    })
                } else {
                  if (isMsg) {
                    VXETable.modal.message({ id: code, message: GlobalConfig.i18n('vxe.grid.dataUnchanged'), status: 'info' })
                  }
                }
              }).catch((errMap: any) => errMap)
            } else {
              UtilTools.error('vxe.error.notFunc', [code])
            }
            break
          }
          default: {
            const btnMethod = VXETable.commands.get(code)
            if (btnMethod) {
              btnMethod({ code, button, $grid: $xegrid, $table: $xetable }, ...args)
            }
          }
        }
        return nextTick()
      },
      zoom () {
        if (reactData.isZMax) {
          return gridMethods.revert()
        }
        return gridMethods.maximize()
      },
      isMaximized () {
        return reactData.isZMax
      },
      maximize () {
        return handleZoom(true)
      },
      revert () {
        return handleZoom()
      },
      getFormItems () {
        const formOpts = computeFormOpts.value
        const { formConfig } = props
        const { items } = formOpts
        return formConfig && items ? items : []
      },
      getPendingRecords () {
        return reactData.pendingRecords
      },
      getProxyInfo () {
        const { sortData } = reactData
        return props.proxyConfig ? {
          data: reactData.tableData,
          filter: reactData.filterData,
          form: reactData.formData,
          sort: sortData.length ? sortData[0] : {},
          sorts: sortData,
          pager: reactData.tablePage,
          pendingRecords: reactData.pendingRecords
        } : null
      }
    }

    const gridPrivateMethods: GridPrivateMethods = {
      /**
       * 获取需要排除的高度
       */
      getExcludeHeight () {
        const { isZMax } = reactData
        const el = refElem.value
        const formWrapper = refFormWrapper.value
        const toolbarWrapper = refToolbarWrapper.value
        const topWrapper = refTopWrapper.value
        const bottomWrapper = refBottomWrapper.value
        const pagerWrapper = refPagerWrapper.value
        const parentPaddingSize = isZMax ? 0 : getPaddingTopBottomSize(el.parentNode as HTMLElement)
        return parentPaddingSize + getPaddingTopBottomSize(el) + getOffsetHeight(formWrapper) + getOffsetHeight(toolbarWrapper) + getOffsetHeight(topWrapper) + getOffsetHeight(bottomWrapper) + getOffsetHeight(pagerWrapper)
      },
      getParentHeight () {
        const el = refElem.value
        return (reactData.isZMax ? DomTools.getDomNode().visibleHeight : (el.parentNode as HTMLElement).clientHeight) - gridPrivateMethods.getExcludeHeight()
      },
      triggerToolbarBtnEvent (button, evnt) {
        gridMethods.commitProxy(button, evnt)
        gridMethods.dispatchEvent('toolbar-button-click', { code: button.code, button }, evnt)
      },
      triggerZoomEvent (evnt) {
        gridMethods.zoom()
        gridMethods.dispatchEvent('zoom', { type: reactData.isZMax ? 'max' : 'revert' }, evnt)
      }
    }

    Object.assign($xegrid, gridExtendTableMethods, gridMethods, gridPrivateMethods)

    watch(() => props.columns, (value) => {
      nextTick(() => gridMethods.loadColumn(value || []))
    })

    watch(() => props.toolbarConfig, (value) => {
      if (value) {
        initToolbar()
      }
    })

    watch(() => props.proxyConfig, () => {
      initProxy()
    })

    watch(() => props.pagerConfig, () => {
      initPages()
    })

    const handleGlobalKeydownEvent = (evnt: any) => {
      const zoomOpts = computeZoomOpts.value
      const isEsc = evnt.keyCode === 27
      if (isEsc && reactData.isZMax && zoomOpts.escRestore !== false) {
        gridPrivateMethods.triggerZoomEvent(evnt)
      }
    }

    nextTick(() => {
      const { data, columns, proxyConfig } = props
      const proxyOpts = computeProxyOpts.value
      const formOpts = computeFormOpts.value
      if (proxyConfig && (data || (proxyOpts.form && formOpts.data))) {
        console.error('[vxe-grid] There is a conflict between the props proxy-config and data.')
      }
      if (columns && columns.length) {
        gridMethods.loadColumn(columns)
      }
      initToolbar()
      initPages()
      initProxy()
      GlobalEvent.on($xegrid, 'keydown', handleGlobalKeydownEvent)
    })

    onUnmounted(() => {
      GlobalEvent.off($xegrid, 'keydown')
    })

    const renderVN = () => {
      const vSize = computeSize.value
      const styles = computeStyles.value
      return h('div', {
        ref: refElem,
        class: ['vxe-grid', {
          [`size--${vSize}`]: vSize,
          't--animat': !!props.animat,
          'is--round': props.round,
          'is--maximize': reactData.isZMax,
          'is--loading': props.loading || reactData.tableLoading
        }],
        style: styles
      }, renderForms().concat(renderToolbars(), renderTops(), renderTables(), renderBottoms(), renderPagers()))
    }

    $xegrid.renderVN = renderVN

    provide('$xegrid', $xegrid)

    return $xegrid
  },
  render () {
    return this.renderVN()
  }
})
