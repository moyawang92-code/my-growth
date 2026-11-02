import { useRef, useState } from 'react';
import { Download, HardDriveDownload, Upload } from 'lucide-react';
import type { BackupFile } from '../domain/types';
import { todayLocalDate } from '../domain/dates';
import { assertValidBackup } from '../data/indexedDbRepository';
import { useGrowthStore } from '../store/GrowthStore';
import { Button, Card, Modal, SectionTitle } from './ui';

export function BackupPanel() {
  const { exportBackup, importBackup, records, books, reflections } = useGrowthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);

  const download = async () => {
    setError(null);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-growth-backup-${todayLocalDate()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('已导出 JSON 备份文件。');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出失败');
    }
  };

  const pickFile = async (file: File | undefined) => {
    setError(null);
    setNotice(null);
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      assertValidBackup(parsed);
      setPending(parsed);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : '文件解析失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    try {
      await importBackup(pending, mode);
      setNotice(
        mode === 'replace'
          ? '已用备份文件替换本地数据。'
          : '已合并备份文件，同一天同一维度保留了较新的记录。',
      );
      setPending(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '导入失败');
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle title="数据备份" description="记录保存在这台设备的浏览器里" />

      <div className="rounded-xl bg-canvas px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
        <p className="flex items-start gap-1.5">
          <HardDriveDownload size={14} className="mt-0.5 shrink-0 text-ink-faint" />
          <span>
            当前版本把数据存在<strong className="font-medium">本机浏览器的 IndexedDB</strong>
            中，不会同步到云端。清理浏览器数据、更换设备或使用隐私模式都可能导致记录丢失，建议定期导出
            JSON 备份。
          </span>
        </p>
        <p className="mt-2 text-ink-faint">
          现有数据：{records.length} 条每日记录 · {books.length} 本书 · {reflections.length} 条感悟
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void download()}>
          <Download size={15} />
          导出 JSON 备份
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          导入备份
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void pickFile(event.target.files?.[0])}
        />
      </div>

      {notice ? <p className="mt-2.5 text-xs text-sage-600">{notice}</p> : null}
      {error ? <p className="mt-2.5 text-xs text-[#a8503f]">{error}</p> : null}

      <Modal
        open={pending !== null}
        title="导入备份"
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button onClick={() => void runImport('merge')}>合并</Button>
            <Button variant="danger" onClick={() => void runImport('replace')}>
              替换全部
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-ink-soft">
          <p>
            备份文件包含 {pending?.dailyRecords.length ?? 0} 条每日记录、
            {pending?.books.length ?? 0} 本书、{pending?.reflections.length ?? 0} 条感悟。
          </p>
          <p>
            <strong className="font-medium text-ink">合并</strong>
            ：保留现有数据，同一天同一维度以较新的记录为准。
          </p>
          <p>
            <strong className="font-medium text-ink">替换全部</strong>
            ：清空当前设备上的所有记录，再写入备份内容，无法撤销。
          </p>
        </div>
      </Modal>
    </Card>
  );
}
