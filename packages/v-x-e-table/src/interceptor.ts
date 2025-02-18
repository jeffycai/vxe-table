import XEUtils from 'xe-utils/ctor'

import { VxeGlobalInterceptor, VxeGlobalInterceptorHandles } from '../../../types/v-x-e-table'

function toType (type: string) {
  return XEUtils.toString('event.' + type).replace('_', '').toLowerCase()
}

const eventTypes = 'clearActived,clearFilter,showMenu,keydown,export,import'.split(',').map(toType)
const storeMap: { [type: string]: VxeGlobalInterceptorHandles.InterceptorCallback[] } = {}

const interceptor: VxeGlobalInterceptor = {
  mixin (options) {
    XEUtils.each(options, (callback: VxeGlobalInterceptorHandles.InterceptorCallback, type) => interceptor.add(type, callback))
    return interceptor
  },
  get (type) {
    return storeMap[toType(type)] || []
  },
  add (type, callback) {
    type = toType(type)
    if (callback && eventTypes.indexOf(type) > -1) {
      let eList = storeMap[type]
      if (!eList) {
        eList = storeMap[type] = []
      }
      eList.push(callback)
    }
    return interceptor
  },
  delete (type, callback) {
    type = toType(type)
    const eList = storeMap[type]
    if (eList) {
      if (callback) {
        XEUtils.remove(eList, fn => fn === callback)
      } else {
        delete storeMap[type]
      }
    }
  }
}

export default interceptor
