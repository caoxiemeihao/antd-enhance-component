/**
 * EnhanceTable 支持快捷键移动光标
 */
import React, { useState, useEffect, useRef } from 'react';

/**
 * 上下键移动光标
 */
export function useUpDownForInput() {
  const [container, setContainer] = useState<any>();

  const tableWrapKeydown = (ev: any) => {
    if (![38, 40].includes(ev.keyCode)) return;
    ev.preventDefault(); // 阻止光标跑到开头

    let className: any = Array.from(ev.target.classList).find((c: any) =>
      /input-\w+-row\d+$/.test(c),
    );
    if (!className) return;

    let rowIdx = +className.replace(/input-\w+-row/, '');
    if (ev.keyCode === 38) {
      // up
      rowIdx = rowIdx - 1;
    } else if (ev.keyCode === 40) {
      // down
      rowIdx = rowIdx + 1;
    }
    className = className.replace(/(input-\w+-row)\d+/, `$1${rowIdx}`);
    const oInput = ev.currentTarget.getElementsByClassName(className)[0];
    if (oInput instanceof HTMLInputElement) {
      setTimeout(() => {
        oInput.focus();
      }, 19);
    }
  };

  useEffect(() => {
    if (!(container instanceof HTMLElement)) return;

    container.addEventListener('keydown', tableWrapKeydown);
    return () => {
      container.removeEventListener('keydown', tableWrapKeydown);
    };
  }, [container]);

  return [setContainer];
}

/**
 * @deprecated
 * 滑动加载
 */
export function useScrollLoad(callback = (bool: boolean) => {}) {
  const [container, setContainer] = useState<any>();
  const ref_state = useRef(false);
  const ref_last = useRef(ref_state.current);

  const tableBodyDivScroll = (ev: any) => {
    const bodyDivRect = ev.target.getBoundingClientRect();
    const tableRect = ev.target.getElementsByTagName('table')[0].getBoundingClientRect();
    const scrollBarHeight = 7; // global.less 中设置的滚动条厚度 7px
    const THRESHOLD = 34; // 触发阈值 (row高度)

    ref_state.current = tableRect.bottom + scrollBarHeight - bodyDivRect.bottom < THRESHOLD;
    if (ref_state.current !== ref_last.current) {
      callback((ref_last.current = ref_state.current));
      // console.log(ref_last.current ? '触底' : '离开')
    }
  };

  useEffect(() => {
    let destroy = () => {};
    if (!(container instanceof HTMLElement)) return;
    const tableContainer = container.getElementsByClassName('ant-table-container')[0];
    if (!(tableContainer instanceof HTMLElement)) return;

    const handle = new MutationObserver(function () {
      const tableBody = container.getElementsByClassName('ant-table-body')[0];
      if (!(tableBody instanceof HTMLElement)) return;
      tableBody.addEventListener('scroll', tableBodyDivScroll);

      destroy = () => {
        handle.disconnect();
        tableBody.removeEventListener('scroll', tableBodyDivScroll);
      };
    });
    handle.observe(tableContainer, { childList: true, subtree: true });

    return destroy;
  }, [container]);

  return [setContainer];
}

/**
 * @deprecated
 */
export interface CalcScrollProps {
  /** 顶部偏移量 (默认50) */
  top?: number;
  /** 底部偏移量 (默认40) */
  bottom?: number;
}

/**
 * @deprecated
 * 计算 scroll: y 值
 */
export function useCalcScrollY(arg0: CalcScrollProps = {}) {
  const [scrollY, setScrollY] = useState(350);
  const [container, setContainer] = useState<any>();
  const setScrollYHandle = () => {
    const clientHeight = document.body.clientHeight;
    const top = container.getBoundingClientRect().top;
    const TOP_DIST = arg0.top ?? 50; // 上边距
    const BOTTOM_DIST = arg0.bottom ?? 40; // 下边距
    const y = clientHeight - top - TOP_DIST - BOTTOM_DIST;
    if (y === scrollY) return;
    setScrollY(Math.max(y, 200)); // 最小 200
  };

  useEffect(() => {
    if (!(container instanceof HTMLElement)) return;
    setScrollYHandle();

    let destroy = () => {};
    const formBuilder = document.getElementsByClassName('formBuilder')[0];
    if (!(formBuilder instanceof HTMLElement)) return;

    const handle = new MutationObserver(setScrollYHandle);
    handle.observe(formBuilder, { childList: true, subtree: true, attributes: true });
    destroy = () => {
      handle.disconnect();
    };
    return destroy;
  }, [container]);

  return { scrollY, setContainer };
}
