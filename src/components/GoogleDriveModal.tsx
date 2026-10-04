import React, { useState, useEffect } from 'react';
import {
  googleSignIn,
  logout,
  getAccessToken,
  initAuth,
} from '../services/auth';
import {
  listDriveWorldFiles,
  saveWorldToDrive,
  loadWorldFromDrive,
  deleteWorldFromDrive,
  DriveWorldFile,
  SavedWorldData,
} from '../services/drive';
import { VoxelGameEngine } from '../game/engine';
import { User } from 'firebase/auth';
import {
  Cloud,
  Download,
  Trash2,
  RefreshCw,
  X,
  HardDrive,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  LogOut,
} from 'lucide-react';
import { BlockType, InventorySlot } from '../game/constants';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: VoxelGameEngine | null;
  inventory: InventorySlot[];
  selectedSlot: number;
  onWorldLoaded: (data: SavedWorldData) => void;
  onNotify: (msg: string) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  engine,
  inventory,
  selectedSlot,
  onWorldLoaded,
  onNotify,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Worlds list
  const [driveFiles, setDriveFiles] = useState<DriveWorldFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Save new world state
  const [worldNameInput, setWorldNameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWorldId, setIsLoadingWorldId] = useState<string | null>(null);

  // Destructive confirmation modal state (MANDATORY per Workspace Skill)
  const [fileToDelete, setFileToDelete] = useState<DriveWorldFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Error / status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setHasToken(!!token);
        setIsLoadingAuth(false);
        if (token) {
          fetchDriveFiles();
        }
      },
      () => {
        getAccessToken().then((token) => {
          setHasToken(!!token);
          setIsLoadingAuth(false);
        });
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch world save files from Google Drive
  const fetchDriveFiles = async () => {
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const files = await listDriveWorldFiles();
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Fetch Drive files error:', err);
      setErrorMsg(err.message || 'Google Drive dosyaları yüklenemedi.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Google Sign-In with popup
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setHasToken(true);
        fetchDriveFiles();
        onNotify('Google Drive ile başarıyla bağlandı!');
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setErrorMsg(err.message || 'Google ile giriş başarısız oldu.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setHasToken(false);
    setDriveFiles([]);
    onNotify('Google oturumu kapatıldı.');
  };

  // Save current world to Drive
  const handleSaveCurrentWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engine) return;

    const trimmedName = worldNameInput.trim() || `Dunya_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}`;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Package world blocks into serializable record
      const blocksRecord: { [key: string]: number } = {};
      engine.worldBlocks.forEach((type, key) => {
        blocksRecord[key] = type;
      });

      const worldData: SavedWorldData = {
        version: 1,
        name: trimmedName,
        savedAt: Date.now(),
        gameMode: engine.player.gameMode,
        timeOfDay: engine.timeOfDay,
        playerPosition: [
          engine.player.position.x,
          engine.player.position.y,
          engine.player.position.z,
        ],
        playerRotation: [
          engine.player.rotation.yaw,
          engine.player.rotation.pitch,
        ],
        blocks: blocksRecord,
        inventory,
        selectedSlot,
        health: engine.player.health,
        hunger: engine.player.hunger,
      };

      await saveWorldToDrive(trimmedName, worldData);
      setSuccessMsg(`"${trimmedName}" başarıyla Google Drive'a kaydedildi!`);
      setWorldNameInput('');
      fetchDriveFiles();
      onNotify(`"${trimmedName}" Google Drive'a kaydedildi!`);
    } catch (err: any) {
      console.error('Save to Drive error:', err);
      setErrorMsg(err.message || 'Dünya Google Drive’a kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load world from Drive
  const handleLoadWorld = async (file: DriveWorldFile) => {
    setIsLoadingWorldId(file.id);
    setErrorMsg(null);
    try {
      const data = await loadWorldFromDrive(file.id);
      onWorldLoaded(data);
      onNotify(`"${file.displayName}" başarıyla yüklendi!`);
      onClose();
    } catch (err: any) {
      console.error('Load from Drive error:', err);
      setErrorMsg(err.message || 'Dünya indirilemedi.');
    } finally {
      setIsLoadingWorldId(null);
    }
  };

  // Destructive deletion confirmation execution
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteWorldFromDrive(fileToDelete.id);
      setSuccessMsg(`"${fileToDelete.displayName}" Google Drive'dan silindi.`);
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setFileToDelete(null);
      onNotify('Dünya Google Drive’dan silindi.');
    } catch (err: any) {
      console.error('Delete error:', err);
      setErrorMsg(err.message || 'Dosya silinemedi.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 select-none">
      <div className="w-full max-w-lg max-h-[92vh] bg-neutral-900 border-2 border-neutral-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-white animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            <span className="font-pixel text-xs text-white">GOOGLE DRIVE BULUT KAYIT</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth status & user badge */}
        <div className="px-4 py-2.5 bg-neutral-850 border-b border-neutral-800 flex items-center justify-between">
          {hasToken && currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-blue-400/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-semibold text-white leading-tight">
                    {currentUser.displayName || currentUser.email}
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Google Drive Bağlı
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 flex items-center gap-1"
                title="Çıkış Yap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Çıkış
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
              <div className="text-xs text-neutral-300 text-center sm:text-left">
                Dünyalarınızı Google Drive’da saklamak için giriş yapın:
              </div>
              {/* Official Google Sign In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="gsi-material-button scale-90 sm:scale-100 origin-right"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningIn ? 'Bağlanıyor...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="px-4 py-2 bg-red-950/80 border-b border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-4 py-2 bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Section 1: Save Current World */}
          <div className="bg-neutral-800/80 border border-neutral-700 rounded-lg p-3">
            <h3 className="text-xs font-bold font-pixel text-amber-400 uppercase flex items-center gap-1.5 mb-2">
              <Save className="w-4 h-4" />
              Şu Anki Dünyayı Drive'a Kaydet
            </h3>
            <form onSubmit={handleSaveCurrentWorld} className="flex gap-2">
              <input
                type="text"
                placeholder="Dünya adı (Örn: Köyüm, Survival 1)"
                value={worldNameInput}
                onChange={(e) => setWorldNameInput(e.target.value)}
                disabled={!hasToken || isSaving}
                className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!hasToken || isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white font-bold text-xs rounded flex items-center gap-1.5 transition-colors shrink-0"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Drive'a Kaydet
                  </>
                )}
              </button>
            </form>
            {!hasToken && (
              <p className="mt-1.5 text-[11px] text-amber-400/90">
                ⚠️ Bulut kayıt için lütfen yukarıdan Google hesabınızla giriş yapın.
              </p>
            )}
          </div>

          {/* Section 2: Drive Saved Worlds List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold font-pixel text-white flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-blue-400" />
                Google Drive’daki Kayıtlar ({driveFiles.length})
              </h3>
              <button
                onClick={fetchDriveFiles}
                disabled={!hasToken || isLoadingFiles}
                className="p-1 text-neutral-400 hover:text-white rounded disabled:opacity-40 transition-colors"
                title="Yenile"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {!hasToken ? (
              <div className="text-center py-8 text-neutral-400 text-xs border border-dashed border-neutral-800 rounded-lg">
                Google Drive dosyalarınızı listelemek için giriş yapın.
              </div>
            ) : isLoadingFiles ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span>Google Drive'dan dünyalar yükleniyor...</span>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs border border-dashed border-neutral-800 rounded-lg">
                Henüz Google Drive'da kayıtlı bir CraftMobile dünyanız yok.
                Yukarıdaki formu kullanarak ilk dünyanızı kaydedin!
              </div>
            ) : (
              <div className="space-y-2">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 bg-neutral-800/90 border border-neutral-700 rounded-lg flex items-center justify-between hover:border-neutral-600 transition-colors"
                  >
                    <div className="flex-1 pr-3">
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                        {file.displayName}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleString('tr-TR', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Tarih yok'}
                        {file.size
                          ? ` • ${(parseInt(file.size, 10) / 1024).toFixed(1)} KB`
                          : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Load Button */}
                      <button
                        onClick={() => handleLoadWorld(file)}
                        disabled={isLoadingWorldId === file.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {isLoadingWorldId === file.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Yükle
                      </button>

                      {/* Delete Button (triggers confirmation dialog) */}
                      <button
                        onClick={() => setFileToDelete(file)}
                        className="p-1.5 bg-neutral-700 hover:bg-red-700/80 text-neutral-300 hover:text-white rounded transition-colors"
                        title="Google Drive'dan Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
          <span>Kayıtlar sadece sizin Google Drive hesabınızda saklanır.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* MANDATORY Confirmation Modal for Destructive Operation (Drive Delete) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-neutral-900 border-2 border-red-600/80 rounded-xl p-5 shadow-2xl text-white animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-red-950/80 text-red-500 border border-red-800 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-center mb-1">
              Dünyayı Silmek İstediğinize Emin Misiniz?
            </h4>

            <p className="text-xs text-neutral-300 text-center mb-4 leading-relaxed">
              <strong className="text-white">"{fileToDelete.displayName}"</strong>{' '}
              adlı dünya dosyası Google Drive hesabınızdan kalıcı olarak
              silinecektir. Bu işlem geri alınamaz.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded flex items-center justify-center gap-1 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Siliniyor...
                  </>
                ) : (
                  'Evet, Sil'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
