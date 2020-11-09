import { SetupContext, RenderFunction, Ref, ComponentPublicInstance } from 'vue'
import { VXETableComponent, VxeComponentInstance, VxeEvent, SizeType, ValueOf, VNodeStyle } from './component'

/**
 * 组件 - 按钮
 */
export interface Button extends VXETableComponent { }

export type VxeButtonInstance = ComponentPublicInstance<VxeButtonProps, VxeButtonConstructor>;

export interface VxeButtonConstructor extends VxeComponentInstance, VxeButtonMethods {
  props: VxeButtonProps;
  context: SetupContext<VxeButtonEmits>;
  reactData: ButtonReactData;
  refMaps: ButtonPrivateRef;
  renderVN: RenderFunction;
}

export interface ButtonPrivateRef {
  refElem: Ref<HTMLDivElement>;
}
export interface VxeButtonPrivateRef extends ButtonPrivateRef { }

export interface ButtonReactData {
  inited: boolean;
  showPanel: boolean;
  animatVisible: boolean;
  panelIndex: number;
  panelStyle: VNodeStyle;
  panelPlacement: any;
}

export interface VxeButtonOptions extends VxeButtonProps, VxeButtonListeners { }

export interface VxeButtonProps {
  size?: SizeType;
  /**
   * 按钮类型
   */
  type: string;
  /**
   * 用来标识这一项
   */
  name: string | number;
  /**
   * 按钮内容
   */
  content: string;
  /**
   * 固定显示下拉面板的方向
   */
  placement: string;
  /**
   * 按钮状态
   */
  status: string;
  /**
   * 按钮的图标
   */
  icon: string;
  /**
   * 圆角边框
   */
  round: boolean;
  /**
   * 圆角按钮
   */
  circle: boolean;
  /**
   * 是否禁用
   */
  disabled: boolean;
  /**
   * 是否加载中
   */
  loading: boolean;
  /**
   * 在下拉面板关闭时销毁内容
   */
  destroyOnClose: boolean;
  /**
   * 是否将弹框容器插入于 body 内
   */
  transfer: boolean;
}

export interface ButtonMethods {
  dispatchEvent(type: ValueOf<VxeButtonEmits>, params: any, evnt: Event): void;
  /**
   * 获取焦点
   */
  focus(): Promise<any>;
  /**
   * 失去焦点
   */
  blur(): Promise<any>;
}
export interface VxeButtonMethods extends ButtonMethods { }

export interface ButtonPrivateMethods { }
export interface VxeButtonPrivateMethods extends ButtonPrivateMethods { }

export type VxeButtonEmits = [
  'click',
  'dropdown-click'
]

export namespace VxeButtonDefines {
  interface ButtonEventParams extends VxeEvent {
    $button: VxeButtonConstructor;
  }

  export interface ClickParams { }
  export interface ClickEventParams extends ButtonEventParams, ClickParams { }

  export interface DropdownClickParams { }
  export interface DropdownClickEventParams extends ButtonEventParams, ClickParams { }
}

export interface VxeButtonListeners {
  onClick?: VxeButtonEvents.Click;
  onDropdownClick?: VxeButtonEvents.DropdownClick;
}

export namespace VxeButtonEvents {
  export type Click = (params: VxeButtonDefines.ClickEventParams) => void;
  export type DropdownClick = (params: VxeButtonDefines.DropdownClickParams) => void;
}
