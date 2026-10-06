import { useState, useEffect, useMemo, useCallback } from 'react';
import { HospitalUnit } from '../../../core/types';
import { hospitalService } from '../../../core/services/hospitalService';
import { matchesSearch, searchTokens } from '../../../core/search';

export function useHospitalMaster() {
  const [hospitals, setHospitals] = useState<HospitalUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [islandFilter, setIslandFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadHospitals = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await hospitalService.getAllHospitals();
      setHospitals(data);
    } catch (err: any) {
      console.error('Failed to load hospitals:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  // Statistics
  const stats = useMemo(() => {
    const total = hospitals.length;
    const active = hospitals.filter((h) => h.isActive).length;
    const inactive = total - active;

    const byIsland: Record<string, number> = {
      Jawa: 0,
      Sumatera: 0,
      'Bali & Nusa Tenggara': 0,
      Kalimantan: 0,
      Sulawesi: 0,
      'Maluku & Papua': 0,
    };

    hospitals.forEach((h) => {
      const isl = h.island || 'Jawa';
      byIsland[isl] = (byIsland[isl] || 0) + 1;
    });

    return { total, active, inactive, byIsland };
  }, [hospitals]);

  // Filtered hospitals
  const filteredHospitals = useMemo(() => {
    const tokens = searchTokens(searchQuery);
    return hospitals.filter((h) => {
      // 1. Island filter
      if (islandFilter !== 'ALL' && h.island !== islandFilter) {
        return false;
      }

      // 2. Status filter
      if (statusFilter === 'ACTIVE' && !h.isActive) return false;
      if (statusFilter === 'INACTIVE' && h.isActive) return false;

      // 3. Search query
      return matchesSearch(tokens, h.name, h.code, h.city, h.province, h.island, h.type);
    });
  }, [hospitals, islandFilter, statusFilter, searchQuery]);

  const saveHospital = async (data: Partial<HospitalUnit> & { name: string; city: string }) => {
    const saved = await hospitalService.saveHospital(data);
    await loadHospitals();
    showToast(`Rumah Sakit "${saved.name}" berhasil disimpan.`);
    return saved;
  };

  const deleteHospital = async (id: string, name: string) => {
    await hospitalService.deleteHospital(id);
    await loadHospitals();
    showToast(`Rumah Sakit "${name}" berhasil dihapus.`);
  };

  const toggleHospitalStatus = async (id: string, currentStatus: boolean, name: string) => {
    await hospitalService.toggleHospitalActive(id, !currentStatus);
    await loadHospitals();
    showToast(`Status RS "${name}" diubah menjadi ${!currentStatus ? 'Aktif' : 'Non-Aktif'}.`);
  };

  const importHospitals = async (file: File) => {
    const res = await hospitalService.parseHospitalExcel(file);
    if (res.validHospitals.length > 0) {
      await hospitalService.bulkSaveHospitals(res.validHospitals);
      await loadHospitals();
      showToast(`Berhasil mengimpor ${res.validHospitals.length} Rumah Sakit (${res.summary.newCount} baru, ${res.summary.updatedCount} diperbarui).`);
    }
    return res;
  };

  const downloadTemplate = () => {
    hospitalService.downloadHospitalTemplate();
  };

  const exportExcel = () => {
    hospitalService.exportHospitalsToExcel(filteredHospitals);
    showToast('File Excel Master Rumah Sakit berhasil diunduh.');
  };

  return {
    hospitals,
    filteredHospitals,
    isLoading,
    searchQuery,
    setSearchQuery,
    islandFilter,
    setIslandFilter,
    statusFilter,
    setStatusFilter,
    stats,
    toastMessage,
    setToastMessage,
    saveHospital,
    deleteHospital,
    toggleHospitalStatus,
    importHospitals,
    downloadTemplate,
    exportExcel,
    refresh: loadHospitals,
  };
}
