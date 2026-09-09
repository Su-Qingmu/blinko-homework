'use client';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';

interface Props {
  onCreate: () => void;
}

export const CollabEmpty = observer(({ onCreate }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-fuchsia-500/15 to-pink-500/15 flex items-center justify-center mb-4">
        <Icon icon="tabler:users" width="40" height="40" className="text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{t('collab-no-team')}</h2>
      <p className="text-desc max-w-md mb-6">{t('collab-no-team-hint')}</p>
      <Button
        color="primary"
        size="lg"
        startContent={<Icon icon="hugeicons:add-01" width="18" height="18" />}
        onPress={onCreate}
      >
        {t('collab-create-team')}
      </Button>
    </div>
  );
});