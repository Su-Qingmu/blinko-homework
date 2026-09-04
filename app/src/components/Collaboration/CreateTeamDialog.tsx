'use client';
import { observer } from 'mobx-react-lite';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { PromiseCall, PromiseState } from '@/store/standard/PromiseState';
import { ToastPlugin } from '@/store/module/Toast/Toast';
import i18n from '@/lib/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateTeamDialog = observer(({ open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);

  const state = useState({
    name: '',
    icon: '',
    description: '',
    creating: false,
  });
  const [s, setS] = state;

  const reset = () => setS({ name: '', icon: '', description: '', creating: false });

  const submit = async () => {
    if (!s.name.trim()) {
      RootStore.Get(ToastPlugin).error(t('collab-team-name-required'));
      return;
    }
    setS({ ...s, creating: true });
    const created = await teamStore.createTeam({
      name: s.name.trim(),
      icon: s.icon.trim() || s.name.charAt(0).toUpperCase(),
      description: s.description.trim(),
    });
    setS({ ...s, creating: false });
    if (created) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      size="lg"
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Icon icon="hugeicons:add-team" width="20" height="20" className="text-primary" />
              {t('collab-create-team')}
            </ModalHeader>
            <ModalBody className="gap-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center text-2xl font-semibold">
                    {(s.icon || s.name.charAt(0) || '?').toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 gap-3 flex flex-col">
                  <Input
                    label={t('collab-team-icon')}
                    placeholder="P"
                    maxLength={2}
                    labelPlacement="outside"
                    variant="bordered"
                    value={s.icon}
                    onChange={(e) => setS({ ...s, icon: e.target.value })}
                    description={t('collab-team-icon-tip')}
                  />
                  <Input
                    label={t('collab-team-name')}
                    placeholder={t('collab-team-name')}
                    labelPlacement="outside"
                    variant="bordered"
                    value={s.name}
                    onChange={(e) => setS({ ...s, name: e.target.value })}
                    isRequired
                  />
                </div>
              </div>
              <Input
                label={t('collab-team-desc')}
                placeholder={t('collab-team-desc')}
                labelPlacement="outside"
                variant="bordered"
                value={s.description}
                onChange={(e) => setS({ ...s, description: e.target.value })}
                maxLength={200}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>{t('cancel')}</Button>
              <Button color="primary" isLoading={s.creating} onPress={submit}>
                {t('create')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
});