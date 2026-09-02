import { Icon as IconifyIcon } from '@iconify/react';
import clsx from 'clsx';

/**
 * 统一图标组件 - 封装 @iconify/react
 *
 * 用法:
 *   <Icon icon="hugeicons:note-01" width={20} height={20} />
 *
 * 常用 icon 集(hugeicons 是 Blinko 默认):
 *   - hugeicons:*    主图标(线性风格,细描边)
 *   - basil:*        闪念/闪电图标
 *   - solar:*        双色风格图标
 *   - mdi:*          Material Design Icons
 *   - mingcute:*     简洁线性图标
 *   - tabler:*       Tabler 图标
 *   - lets-icons:*   复选框
 *   - ci:*           单选框
 */
export function Icon({
  icon,
  width = 18,
  height,
  className,
  ...rest
}: {
  icon: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <IconifyIcon
      icon={icon}
      width={width}
      height={height ?? width}
      className={clsx('inline-block shrink-0', className)}
      {...rest}
    />
  );
}
