import { createCommentVNode, defineComponent, h, ref, Ref, PropType, inject, nextTick, ComputedRef, onBeforeUnmount } from 'vue'
import XEUtils from 'xe-utils/ctor'
import GlobalConfig from '../../conf'
import VXETable from '../../v-x-e-table'
import { UtilTools, DomTools } from '../../tools'
import { mergeBodyMethod, getRowid } from './util'

import { VxeTablePrivateMethods, VxeTableConstructor, VxeTableMethods, VxeGlobalRendererHandles, SizeType } from '../../../types/vxe-table'

const renderType = 'body'

const lineOffsetSizes: any = {
  mini: 3,
  small: 2,
  medium: 1
}

interface XEBodyScrollElement extends HTMLDivElement {
  _onscroll: ((evnt: Event) => any) | null;
}

export default defineComponent({
  name: 'VxeTableBody',
  props: {
    tableData: Array as PropType<any[]>,
    tableColumn: Array as PropType<any[]>,
    fixedColumn: Array as PropType<any[]>,
    fixedType: String
  },
  setup (props) {
    const $xetable = inject('$xetable', {} as VxeTableConstructor & VxeTableMethods & VxeTablePrivateMethods)

    const xesize = inject('xesize', null as ComputedRef<SizeType> | null)

    const { xID, props: tableProps, context: tableContext, reactData: tableReactData, internalData: tableInternalData, refMaps: tableRefMaps, computeMaps: tableComputeMaps } = $xetable
    const { refTableHeader, refTableBody, refTableFooter, refTableLeftBody, refTableRightBody, refValidTooltip } = tableRefMaps
    const { computeEditOpts, computeMouseOpts, computeEmptyOpts, computeKeyboardOpts, computeTooltipOpts, computeRadioOpts, computeTreeOpts, computeCheckboxOpts, computeValidOpts } = tableComputeMaps

    const refElem = ref() as Ref<XEBodyScrollElement>
    const refBodyTable = ref() as Ref<HTMLTableElement>
    const refBodyColgroup = ref() as Ref<HTMLTableColElement>
    const refBodyTBody = ref() as Ref<HTMLTableSectionElement>
    const refBodyXSpace = ref() as Ref<HTMLDivElement>
    const refBodyYSpace = ref() as Ref<HTMLDivElement>
    const refBodyEmptyBlock = ref() as Ref<HTMLDivElement>

    const getOffsetSize = () => {
      if (xesize) {
        const vSize = xesize.value
        if (vSize) {
          return lineOffsetSizes[vSize] || 0
        }
      }
      return 0
    }

    const countTreeExpand = (prevRow: any, params: any) => {
      const treeOpts = computeTreeOpts.value
      const rowChildren = prevRow[treeOpts.children]
      let count = 1
      if ($xetable.isTreeExpandByRow(prevRow)) {
        for (let index = 0; index < rowChildren.length; index++) {
          count += countTreeExpand(rowChildren[index], params)
        }
      }
      return count
    }

    const calcTreeLine = (params: any, items: any) => {
      const { $rowIndex } = params
      let expandSize = 1
      if ($rowIndex) {
        expandSize = countTreeExpand(items[$rowIndex - 1], params)
      }
      return tableReactData.rowHeight * expandSize - ($rowIndex ? 1 : (12 - getOffsetSize()))
    }

    // 滚动、拖动过程中不需要触发
    const isOperateMouse = () => {
      const { delayHover } = tableProps
      const { lastScrollTime, _isResize } = tableInternalData
      return _isResize || (lastScrollTime && Date.now() < lastScrollTime + (delayHover as number))
    }

    const renderLine = (rowLevel: any, items: any, params: any) => {
      const { column } = params
      const { treeConfig } = tableProps
      const treeOpts = computeTreeOpts.value
      const { slots, treeNode } = column
      if (slots && slots.line) {
        return slots.line(params)
      }
      if (treeConfig && treeNode && treeOpts.line) {
        return [
          h('div', {
            class: 'vxe-tree--line-wrapper'
          }, [
            h('div', {
              class: 'vxe-tree--line',
              style: {
                height: `${calcTreeLine(params, items)}px`,
                left: `${(rowLevel * treeOpts.indent) + (rowLevel ? 2 - getOffsetSize() : 0) + 16}px`
              }
            })
          ])
        ]
      }
      return []
    }

    /**
     * 渲染列
     */
    const renderColumn = ($seq: any, seq: any, rowid: any, fixedType: any, rowLevel: any, row: any, rowIndex: number, $rowIndex: number, _rowIndex: number, column: any, $columnIndex: number, columns: any, items: any) => {
      const { columnKey, height, showOverflow: allColumnOverflow, cellClassName, cellStyle, align: allAlign, spanMethod, mouseConfig, editConfig, editRules } = tableProps
      const { tableData, overflowX, scrollXLoad, scrollYLoad, currentColumn, mergeList, editStore, validStore } = tableReactData
      const { afterFullData } = tableInternalData
      const validOpts = computeValidOpts.value
      const checkboxOpts = computeCheckboxOpts.value
      const editOpts = computeEditOpts.value
      const tooltipOpts = computeTooltipOpts.value
      const { type, cellRender, editRender, align, showOverflow, className, treeNode } = column
      const { actived } = editStore
      const { enabled } = tooltipOpts
      const columnIndex = $xetable.getColumnIndex(column)
      const _columnIndex = $xetable.getVTColumnIndex(column)
      let fixedHiddenColumn = fixedType ? column.fixed !== fixedType : column.fixed && overflowX
      const cellOverflow = (XEUtils.isUndefined(showOverflow) || XEUtils.isNull(showOverflow)) ? allColumnOverflow : showOverflow
      let showEllipsis = cellOverflow === 'ellipsis'
      const showTitle = cellOverflow === 'title'
      const showTooltip = cellOverflow === true || cellOverflow === 'tooltip'
      let hasEllipsis = showTitle || showTooltip || showEllipsis
      let isDirty
      const tdOns: any = {}
      const cellAlign = align || allAlign
      const hasValidError = validStore.row === row && validStore.column === column
      const hasDefaultTip = editRules && (validOpts.message === 'default' ? (height || tableData.length > 1) : validOpts.message === 'inline')
      const attrs: any = { 'data-colid': column.id }
      const params = { $table: $xetable, $seq, seq, rowid, row, rowIndex, $rowIndex, _rowIndex, column, columnIndex, $columnIndex, _columnIndex, fixed: fixedType, type: renderType, isHidden: fixedHiddenColumn, level: rowLevel, visibleData: afterFullData, data: tableData, items }
      // 虚拟滚动不支持动态高度
      if ((scrollXLoad || scrollYLoad) && !hasEllipsis) {
        showEllipsis = hasEllipsis = true
      }
      // hover 进入事件
      if (showTitle || showTooltip || enabled) {
        tdOns.onMouseenter = (evnt: any) => {
          if (isOperateMouse()) {
            return
          }
          if (showTitle) {
            DomTools.updateCellTitle(evnt.currentTarget, column)
          } else if (showTooltip || enabled) {
            // 如果配置了显示 tooltip
            $xetable.triggerBodyTooltipEvent(evnt, params)
          }
          $xetable.dispatchEvent('cell-mouseenter', Object.assign({ cell: evnt.currentTarget }, params), evnt)
        }
      }
      // hover 退出事件
      if (showTooltip || enabled) {
        tdOns.onMouseleave = (evnt: any) => {
          if (isOperateMouse()) {
            return
          }
          if (showTooltip || enabled) {
            $xetable.handleTargetLeaveEvent()
          }
          $xetable.dispatchEvent('cell-mouseleave', Object.assign({ cell: evnt.currentTarget }, params), evnt)
        }
      }
      // 按下事件处理
      if (checkboxOpts.range || mouseConfig) {
        tdOns.onMousedown = (evnt: any) => {
          $xetable.triggerCellMousedownEvent(evnt, params)
        }
      }
      // 点击事件处理
      tdOns.onClick = (evnt: any) => {
        $xetable.triggerCellClickEvent(evnt, params)
      }
      // 双击事件处理
      tdOns.onDblclick = (evnt: any) => {
        $xetable.triggerCellDBLClickEvent(evnt, params)
      }
      // 合并行或列
      if (mergeList.length) {
        const spanRest = mergeBodyMethod(mergeList, _rowIndex, _columnIndex)
        if (spanRest) {
          const { rowspan, colspan }: any = spanRest
          if (!rowspan || !colspan) {
            return null
          }
          if (rowspan > 1) {
            attrs.rowspan = rowspan
          }
          if (colspan > 1) {
            attrs.colspan = colspan
          }
        }
      } else if (spanMethod) {
        // 自定义合并行或列的方法
        const { rowspan = 1, colspan = 1 }: any = spanMethod(params) || {}
        if (!rowspan || !colspan) {
          return null
        }
        if (rowspan > 1) {
          attrs.rowspan = rowspan
        }
        if (colspan > 1) {
          attrs.colspan = colspan
        }
      }
      // 如果被合并不可隐藏
      if (fixedHiddenColumn && mergeList) {
        if (attrs.colspan > 1 || attrs.rowspan > 1) {
          fixedHiddenColumn = false
        }
      }
      // 如果编辑列开启显示状态
      if (!fixedHiddenColumn && editConfig && (editRender || cellRender) && editOpts.showStatus) {
        isDirty = $xetable.isUpdateByRow(row, column.property)
      }
      const tdVNs = []
      if (allColumnOverflow && fixedHiddenColumn) {
        tdVNs.push(
          h('div', {
            class: ['vxe-cell', {
              'c--title': showTitle,
              'c--tooltip': showTooltip,
              'c--ellipsis': showEllipsis
            }]
          })
        )
      } else {
        // 渲染单元格
        tdVNs.push(
          ...renderLine(rowLevel, items, params),
          h('div', {
            class: ['vxe-cell', {
              'c--title': showTitle,
              'c--tooltip': showTooltip,
              'c--ellipsis': showEllipsis
            }],
            title: showTitle ? UtilTools.getCellLabel(row, column, params) : null
          }, column.renderCell(params))
        )
        if (hasDefaultTip && hasValidError) {
          tdVNs.push(
            h('div', {
              class: 'vxe-cell--valid',
              style: validStore.rule && validStore.rule.maxWidth ? {
                width: `${validStore.rule.maxWidth}px`
              } : null
            }, [
              h('span', {
                class: 'vxe-cell--valid-msg'
              }, validStore.content)
            ])
          )
        }
      }

      return h('td', {
        class: ['vxe-body--column', column.id, {
          [`col--${cellAlign}`]: cellAlign,
          [`col--${type}`]: type,
          'col--last': $columnIndex === columns.length - 1,
          'col--tree-node': treeNode,
          'col--edit': !!editRender,
          'col--ellipsis': hasEllipsis,
          'fixed--hidden': fixedHiddenColumn,
          'col--dirty': isDirty,
          'col--actived': editConfig && editRender && (actived.row === row && (actived.column === column || editOpts.mode === 'row')),
          'col--valid-error': hasValidError,
          'col--current': currentColumn === column
        }, UtilTools.getClass(className, params), UtilTools.getClass(cellClassName, params)],
        key: columnKey ? column.id : $columnIndex,
        ...attrs,
        style: cellStyle ? (XEUtils.isFunction(cellStyle) ? cellStyle(params) : cellStyle) : null,
        ...tdOns
      }, tdVNs)
    }

    const renderRows = ($seq: any, rowLevel: any, fixedType: any, tableData: any, tableColumn: any) => {
      const { stripe, rowKey, highlightHoverRow, rowClassName, rowStyle, showOverflow: allColumnOverflow, treeConfig } = tableProps
      const { treeExpandeds, scrollYLoad, editStore, rowExpandeds, expandColumn, selectRow } = tableReactData
      const { scrollYStore } = tableInternalData
      const checkboxOpts = computeCheckboxOpts.value
      const radioOpts = computeRadioOpts.value
      const treeOpts = computeTreeOpts.value
      const rows: any[] = []
      tableData.forEach((row: any, $rowIndex: any) => {
        const trOn: any = {}
        let rowIndex = $rowIndex
        let seq = rowIndex + 1
        if (scrollYLoad) {
          seq += scrollYStore.startIndex
        }
        const _rowIndex = $xetable.getVTRowIndex(row)
        // 确保任何情况下 rowIndex 都精准指向真实 data 索引
        rowIndex = $xetable.getRowIndex(row)
        // 事件绑定
        if (highlightHoverRow) {
          trOn.onMouseenter = (evnt: any) => {
            if (isOperateMouse()) {
              return
            }
            $xetable.triggerHoverEvent(evnt, { row, rowIndex })
          }
          trOn.onMouseleave = () => {
            if (isOperateMouse()) {
              return
            }
            $xetable.clearHoverRow()
          }
        }
        const rowid = getRowid($xetable, row)
        const params = { $table: $xetable, $seq, seq, rowid, fixed: fixedType, type: renderType, level: rowLevel, row, rowIndex, $rowIndex, _rowIndex }
        rows.push(
          h('tr', {
            class: ['vxe-body--row', {
              'row--stripe': stripe && ($xetable.getVTRowIndex(row) + 1) % 2 === 0,
              'is--new': editStore.insertList.indexOf(row) > -1,
              'row--radio': radioOpts.highlight && selectRow === row,
              'row--checked': checkboxOpts.highlight && $xetable.isCheckedByCheckboxRow(row)
            }, rowClassName ? XEUtils.isFunction(rowClassName) ? rowClassName(params) : rowClassName : ''],
            'data-rowid': rowid,
            style: rowStyle ? (XEUtils.isFunction(rowStyle) ? rowStyle(params) : rowStyle) : null,
            key: rowKey || treeConfig ? rowid : $rowIndex,
            ...trOn
          }, tableColumn.map((column: any, $columnIndex: any) => {
            return renderColumn($seq, seq, rowid, fixedType, rowLevel, row, rowIndex, $rowIndex, _rowIndex, column, $columnIndex, tableColumn, tableData)
          }))
        )
        // 如果行被展开了
        if (expandColumn && rowExpandeds.length && rowExpandeds.indexOf(row) > -1) {
          let cellStyle
          if (treeConfig) {
            cellStyle = {
              paddingLeft: `${(rowLevel * treeOpts.indent) + 30}px`
            }
          }
          const { showOverflow } = expandColumn
          const hasEllipsis = (XEUtils.isUndefined(showOverflow) || XEUtils.isNull(showOverflow)) ? allColumnOverflow : showOverflow
          const expandParams = { $table: $xetable, $seq, seq, column: expandColumn, fixed: fixedType, type: renderType, level: rowLevel, row, rowIndex, $rowIndex, _rowIndex }
          rows.push(
            h('tr', {
              class: 'vxe-body--expanded-row',
              key: `expand_${rowid}`,
              style: rowStyle ? (XEUtils.isFunction(rowStyle) ? rowStyle(expandParams) : rowStyle) : null,
              ...trOn
            }, [
              h('td', {
                class: ['vxe-body--expanded-column', {
                  'fixed--hidden': fixedType,
                  'col--ellipsis': hasEllipsis
                }],
                colspan: tableColumn.length
              }, [
                h('div', {
                  class: 'vxe-body--expanded-cell',
                  style: cellStyle
                }, [
                  expandColumn.renderData(expandParams)
                ])
              ])
            ])
          )
        }
        // 如果是树形表格
        if (treeConfig && treeExpandeds.length) {
          const rowChildren = row[treeOpts.children]
          if (rowChildren && rowChildren.length && treeExpandeds.indexOf(row) > -1) {
            rows.push(...renderRows($seq ? `${$seq}.${seq}` : `${seq}`, rowLevel + 1, fixedType, rowChildren, tableColumn))
          }
        }
      })
      return rows
    }

    /**
     * 同步滚动条
     * scroll 方式：可以使固定列与内容保持一致的滚动效果，实现相对麻烦
     * mousewheel 方式：对于同步滚动效果就略差了，左右滚动，内容跟随即可
     * css3 translate 方式：对于同步滚动效果会有产生卡顿感觉，虽然可以利用硬件加速，渲染性能略优，但失去table布局能力
     */
    let scrollProcessTimeout: any
    const syncBodyScroll = (scrollTop: any, elem1: any, elem2: any) => {
      if (elem1 || elem2) {
        if (elem1) {
          elem1.onscroll = null
          elem1.scrollTop = scrollTop
        }
        if (elem2) {
          elem2.onscroll = null
          elem2.scrollTop = scrollTop
        }
        clearTimeout(scrollProcessTimeout)
        scrollProcessTimeout = setTimeout(function () {
          if (elem1) {
            elem1.onscroll = elem1._onscroll
          }
          if (elem2) {
            elem2.onscroll = elem2._onscroll
          }
        }, 100)
      }
    }

    /**
     * 滚动处理
     * 如果存在列固定左侧，同步更新滚动状态
     * 如果存在列固定右侧，同步更新滚动状态
     */
    const scrollEvent = (evnt: Event) => {
      const { fixedType } = props
      const { highlightHoverRow } = tableProps
      const { scrollXLoad, scrollYLoad } = tableReactData
      const { lastScrollTop, lastScrollLeft } = tableInternalData
      const tableHeader = refTableHeader.value
      const tableBody = refTableBody.value
      const tableFooter = refTableFooter.value
      const leftBody = refTableLeftBody.value
      const rightBody = refTableRightBody.value
      const validTip = refValidTooltip.value
      const scrollBodyElem = refElem.value
      const headerElem = tableHeader ? tableHeader.$el as HTMLDivElement : null
      const footerElem = tableFooter ? tableFooter.$el as HTMLDivElement : null
      const bodyElem = tableBody.$el as HTMLDivElement
      const leftElem = leftBody ? leftBody.$el as HTMLDivElement : null
      const rightElem = rightBody ? rightBody.$el as HTMLDivElement : null
      let scrollTop = scrollBodyElem.scrollTop
      const scrollLeft = bodyElem.scrollLeft
      const isX = scrollLeft !== lastScrollLeft
      const isY = scrollTop !== lastScrollTop
      tableInternalData.lastScrollTop = scrollTop
      tableInternalData.lastScrollLeft = scrollLeft
      tableInternalData.lastScrollTime = Date.now()
      if (highlightHoverRow) {
        $xetable.clearHoverRow()
      }
      if (leftElem && fixedType === 'left') {
        scrollTop = leftElem.scrollTop
        syncBodyScroll(scrollTop, bodyElem, rightElem)
      } else if (rightElem && fixedType === 'right') {
        scrollTop = rightElem.scrollTop
        syncBodyScroll(scrollTop, bodyElem, leftElem)
      } else {
        if (isX) {
          if (headerElem) {
            headerElem.scrollLeft = bodyElem.scrollLeft
          }
          if (footerElem) {
            footerElem.scrollLeft = bodyElem.scrollLeft
          }
        }
        if (leftElem || rightElem) {
          $xetable.checkScrolling()
          if (isY) {
            syncBodyScroll(scrollTop, leftElem, rightElem)
          }
        }
      }
      if (scrollXLoad && isX) {
        $xetable.triggerScrollXEvent(evnt)
        if (headerElem && scrollLeft + bodyElem.clientWidth >= bodyElem.scrollWidth - 80) {
          // 修复拖动滚动条时可能存在不同步问题
          nextTick(() => {
            if (bodyElem.scrollLeft !== headerElem.scrollLeft) {
              headerElem.scrollLeft = bodyElem.scrollLeft
            }
          })
        }
      }
      if (scrollYLoad && isY) {
        $xetable.triggerScrollYEvent(evnt)
      }
      if (isX && validTip && validTip.reactData.visible) {
        validTip.updatePlacement()
      }
      $xetable.dispatchEvent('scroll', { type: renderType, fixed: fixedType, scrollTop, scrollLeft, isX, isY }, evnt)
    }

    nextTick(() => {
      const { fixedType } = props
      const { elemStore } = tableInternalData
      const prefix = `${fixedType || 'main'}-body-`
      const el = refElem.value
      elemStore[`${prefix}wrapper`] = refElem.value
      elemStore[`${prefix}table`] = refBodyTable.value
      elemStore[`${prefix}colgroup`] = refBodyColgroup.value
      elemStore[`${prefix}list`] = refBodyTBody.value
      elemStore[`${prefix}xSpace`] = refBodyXSpace.value
      elemStore[`${prefix}ySpace`] = refBodyYSpace.value
      elemStore[`${prefix}emptyBlock`] = refBodyEmptyBlock.value
      el.onscroll = scrollEvent
      el._onscroll = scrollEvent
    })

    onBeforeUnmount(() => {
      const el = refElem.value
      el._onscroll = null
      el.onscroll = null
    })

    const renderVN = () => {
      let { fixedColumn, fixedType, tableColumn } = props
      const { keyboardConfig, showOverflow: allColumnOverflow, spanMethod, mouseConfig, emptyRender } = tableProps
      const { tableData, mergeList, scrollXLoad } = tableReactData
      const { slots } = tableContext
      const emptyOpts = computeEmptyOpts.value
      const keyboardOpts = computeKeyboardOpts.value
      const mouseOpts = computeMouseOpts.value
      // 如果是固定列与设置了超出隐藏
      if (!mergeList.length && !spanMethod && !(keyboardConfig && keyboardOpts.isMerge)) {
        if (fixedType && allColumnOverflow) {
          tableColumn = fixedColumn
        } else if (scrollXLoad) {
          if (fixedType) {
            tableColumn = fixedColumn
          }
        }
      }
      let emptyContent: string | VxeGlobalRendererHandles.RenderResult
      if (slots.empty) {
        emptyContent = slots.empty({ $table: $xetable })
      } else {
        const compConf = emptyRender ? VXETable.renderer.get(emptyOpts.name) : null
        if (compConf && compConf.renderEmpty) {
          emptyContent = compConf.renderEmpty(emptyOpts, { $table: $xetable })
        } else {
          emptyContent = tableProps.emptyText || GlobalConfig.i18n('vxe.table.emptyText')
        }
      }

      return h('div', {
        ref: refElem,
        class: ['vxe-table--body-wrapper', fixedType ? `fixed-${fixedType}--wrapper` : 'body--wrapper'],
        'data-tid': xID
      }, [
        fixedType ? createCommentVNode() : h('div', {
          ref: refBodyXSpace,
          class: 'vxe-body--x-space'
        }),
        h('div', {
          ref: refBodyYSpace,
          class: 'vxe-body--y-space'
        }),
        h('table', {
          ref: refBodyTable,
          class: 'vxe-table--body',
          'data-tid': xID,
          cellspacing: 0,
          cellpadding: 0,
          border: 0
        }, [
          /**
           * 列宽
           */
          h('colgroup', {
            ref: refBodyColgroup
          }, (tableColumn as any[]).map((column, $columnIndex) => {
            return h('col', {
              name: column.id,
              key: $columnIndex
            })
          })),
          /**
           * 内容
           */
          h('tbody', {
            ref: refBodyTBody
          }, renderRows('', 0, fixedType, tableData, tableColumn))
        ]),
        h('div', {
          class: 'vxe-table--checkbox-range'
        }),
        mouseConfig && mouseOpts.area ? h('div', {
          class: 'vxe-table--cell-area'
        }, [
          h('span', {
            class: 'vxe-table--cell-main-area'
          }, mouseOpts.extension ? [
            h('span', {
              class: 'vxe-table--cell-main-area-btn',
              onMousedown (evnt: any) {
                $xetable.triggerCellExtendMousedownEvent(evnt, { $table: $xetable, fixed: fixedType, type: renderType })
              }
            })
          ] : []),
          h('span', {
            class: 'vxe-table--cell-copy-area'
          }),
          h('span', {
            class: 'vxe-table--cell-extend-area'
          }),
          h('span', {
            class: 'vxe-table--cell-multi-area'
          }),
          h('span', {
            class: 'vxe-table--cell-active-area'
          })
        ]) : null,
        !fixedType ? h('div', {
          class: 'vxe-table--empty-block',
          ref: refBodyEmptyBlock
        }, [
          h('div', {
            class: 'vxe-table--empty-content'
          }, emptyContent)
        ]) : null
      ])
    }

    return renderVN
  }
})
