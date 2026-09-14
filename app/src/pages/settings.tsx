import { observer } from 'mobx-react-lite';
import { BasicSetting } from '@/components/BlinkoSettings/BasicSetting';
import AiSetting from '@/components/BlinkoSettings/AiSetting/AiSetting';
import { PerferSetting } from '@/components/BlinkoSettings/PerferSetting';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { UserStore } from '@/store/user';
import { RootStore } from '@/store';
import { UserSetting } from '@/components/BlinkoSettings/UserSetting';
import { useTranslation } from 'react-i18next';
import { JSX } from 'react';
import { ScrollableTabs, TabItem } from '@/components/Common/ScrollableTabs';
import { useState, useEffect } from 'react';
import { BlinkoStore } from '@/store/blinkoStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Icon } from '@/components/Common/Iconify/icons';

type SettingItem = {
  key: string;
  title: string;
  icon: string;
  component: JSX.Element;
  requireAdmin: boolean;
  keywords?: string[];
};

// 精简版设置:只保留 4 项
// 删除: hotkey(Tauri 桌面端依赖)、httpproxy(代理)、task(定时任务)、storage(数据库配置)、
//       music(音乐)、import(数据导入)、sso(单点登录)、export(数据导出)、plugin(插件)
export const allSettings: SettingItem[] = [
  {
    key: 'basic',
    title: ('basic-information'),
    icon: 'tabler:tool',
    component: <BasicSetting />,
    requireAdmin: false,
    keywords: ['basic', 'information', '基本信息', '基础设置'],
  },
  {
    key: 'prefer',
    title: ('preference'),
    icon: 'tabler:settings-2',
    component: <PerferSetting />,
    requireAdmin: false,
    keywords: ['preference', 'theme', 'language', '偏好设置', '主题', '语言'],
  },
  {
    key: 'user',
    title: ('user-list'),
    icon: 'tabler:users',
    component: <UserSetting />,
    requireAdmin: true,
    keywords: ['user', 'users', '用户', '用户列表'],
  },
  {
    key: 'ai',
    title: 'AI',
    icon: 'hugeicons:ai-beautify',
    component: <AiSetting />,
    requireAdmin: false,
    keywords: ['ai', 'artificial intelligence', '人工智能'],
  },
];
const Page = observer(() => {
  const user = RootStore.Get(UserStore);
  const blinkoStore = RootStore.Get(BlinkoStore);
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>('basic');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const getVisibleSettings = () => {
    let settings = allSettings.filter((setting) => !setting.requireAdmin || user.isSuperAdmin);

    if (blinkoStore.searchText) {
      const lowerSearchText = blinkoStore.searchText.toLowerCase();
      const filteredSettings = settings.filter((setting) =>
        setting.title.toLowerCase().includes(lowerSearchText) ||
        setting.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerSearchText))
      );

      // If no settings match the search criteria, return all settings instead of an empty list
      if (filteredSettings.length === 0) {
        return settings;
      }

      return filteredSettings;
    }

    return settings;
  };

  const getCurrentComponent = () => {
    const setting = allSettings.find((s) => s.key === selected);
    return setting ? <div key={setting.key}>{setting.component}</div> : null;
  };

  const tabItems: TabItem[] = getVisibleSettings().map((setting) => ({
    key: setting.key,
    title: setting.title,
    icon: setting.icon,
  }));

  return (
    <div className="h-full flex flex-col">
      {isMobile ? (
        <div className="w-full">
          <div className="sticky top-0 z-10 w-full">
            <div className="mx-1 backdrop-blur-md bg-background rounded-2xl">
              {isMobile && <div className='h-16'></div>}
              <ScrollableTabs
                items={tabItems}
                selectedKey={selected}
                onSelectionChange={setSelected}
                color="primary"
              />
            </div>
          </div>
          <ScrollArea onBottom={() => { }} className="flex-1">
            <div className="max-w-[1024px] mx-auto flex flex-col gap-6 px-2 py-4">
              {getCurrentComponent()}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="w-full max-w-[1200px] mx-auto px-4 py-4 flex flex-row h-full">
          <div className="w-56 mr-6">
            <div className="rounded-xl bg-background p-1 mb-4">
              <ScrollArea onBottom={() => { }} className="h-auto max-h-[calc(100vh-140px)]">
                <div className="p-1 flex flex-col flex-nowrap gap-1">
                  {tabItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setSelected(item.key)}
                      className={`cursor-pointer flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${selected === item.key
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-muted/50 text-foreground/80 hover:text-foreground'
                        }`}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 mr-2">
                          <Icon icon={item.icon} width="18" />
                        </span>
                      )}
                      <span className="font-bold">{typeof item.title === 'string' ? t(item.title) : item.title}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea onBottom={() => { }} className="h-full">
              <div className="max-w-[900px] mx-auto flex flex-col gap-6">
                {getCurrentComponent()}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
});

export default Page;
